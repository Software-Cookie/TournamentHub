import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import type { Prisma, Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type SessionUser = { id: string; role: Role; name?: string | null; email?: string | null; image?: string | null };

export const ADMIN_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];
export const isAdminRole = (role?: Role | null) => !!role && ADMIN_ROLES.includes(role);

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
});

export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
  return user;
}

/** For pages: unauthenticated -> login, non-admin -> 404 (the admin surface is not advertised). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (!isAdminRole(user.role)) notFound();
  return user;
}

export class AuthzError extends Error {
  constructor(
    public status: 401 | 403,
    message = status === 401 ? "Please sign in to continue." : "You do not have permission to do that.",
  ) {
    super(message);
  }
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError(401);
  return user;
}

export async function assertAdmin() {
  const user = await assertUser();
  if (!isAdminRole(user.role)) throw new AuthzError(403);
  return user;
}

// ─── Organisers (multi-organisation) ─────────────────────────

/** Organisation ids the user belongs to (owner / manager / staff). */
export const getMemberOrgIds = cache(async (userId: string) => {
  const rows = await db.organisationMember.findMany({ where: { userId, organisation: { isActive: true } }, select: { organisationId: true } });
  return rows.map((r) => r.organisationId);
});

/** Prisma filter restricting tournaments to what the user may manage. Admins see everything. */
export async function manageScope(user: SessionUser): Promise<Prisma.TournamentWhereInput> {
  if (isAdminRole(user.role)) return {};
  return { organisationId: { in: await getMemberOrgIds(user.id) } };
}

export async function canManageTournament(user: SessionUser, tournamentId: string) {
  if (isAdminRole(user.role)) return true;
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, select: { organisationId: true } });
  if (!t?.organisationId) return false;
  return (await getMemberOrgIds(user.id)).includes(t.organisationId);
}

/** For pages under /manage: must be an admin or belong to an organisation. */
export async function requireManager(callbackUrl = "/manage") {
  const user = await requireUser(callbackUrl);
  if (isAdminRole(user.role)) return user;
  if ((await getMemberOrgIds(user.id)).length === 0) redirect("/host");
  return user;
}

/** For pages under /manage/tournaments/[id]: 404 unless the user may manage this tournament. */
export async function requireTournamentManager(tournamentId: string) {
  const user = await requireManager(`/manage/tournaments/${tournamentId}`);
  if (!(await canManageTournament(user, tournamentId))) notFound();
  return user;
}

/** For server actions / route handlers. Unknown or foreign tournaments look identical (403). */
export async function assertCanManageTournament(tournamentId: string | null | undefined) {
  const user = await assertUser();
  if (!tournamentId || !(await canManageTournament(user, tournamentId))) throw new AuthzError(403);
  return user;
}

function ownershipFilter(user: SessionUser) {
  const email = user.email?.toLowerCase();
  return [{ userId: user.id }, ...(email ? [{ participants: { some: { email } } }] : [])];
}

/**
 * Who may see a tournament's protected fixtures / match details:
 *  - administrators
 *  - the account that made a CONFIRMED registration in the tournament
 *  - any account whose (verified) email belongs to a participant of a CONFIRMED registration, e.g. a doubles partner
 */
export async function canViewTournamentMatches(user: SessionUser | null, tournamentId: string) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const reg = await db.registration.findFirst({
    where: { tournamentId, status: "CONFIRMED", OR: ownershipFilter(user) },
    select: { id: true },
  });
  return Boolean(reg);
}

/** Registrations the user owns (as registrant or as a listed participant). */
export async function myRegistrationWhere(user: SessionUser) {
  return { OR: ownershipFilter(user) };
}

export async function canAccessRegistration(user: SessionUser, registrationId: string) {
  if (isAdminRole(user.role)) return true;
  const reg = await db.registration.findFirst({ where: { id: registrationId, OR: ownershipFilter(user) }, select: { id: true } });
  return Boolean(reg);
}
