import type { Metadata } from "next";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { getMemberOrgIds, isAdminRole, requireUser } from "@/lib/authz";
import { isPremiumUser } from "@/server/membership";
import { PremiumModal } from "@/components/premium/premium-modal";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard · TournamentHub" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const [orgIds, isPremium] = await Promise.all([getMemberOrgIds(user.id), isPremiumUser(user.id)]);
  const organiser = isAdminRole(user.role) || orgIds.length > 0;
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "LayoutDashboard", exact: true },
    { href: "/dashboard/tournaments", label: "My tournaments", icon: "Trophy" },
    { href: "/dashboard/matches", label: "Match centre", icon: "Swords" },
    { href: "/dashboard/tickets", label: "My tickets", icon: "Ticket" },
    { href: "/tournaments", label: "Find tournaments", icon: "Search" },
    { href: organiser ? "/manage" : "/host", label: organiser ? "Organiser console" : "Host a tournament", icon: "Briefcase" },
    { href: "/dashboard/profile", label: "Profile", icon: "UserRound" },
  ];
  return (
    <DashboardShell nav={nav} user={{ name: user.name, email: user.email, isPremium }} title="Player dashboard" footerLink={isAdminRole(user.role) ? { href: "/admin", label: "Platform admin →" } : undefined}>
      {children}
      <PremiumModal isAuthenticated isPremium={isPremium} />
    </DashboardShell>
  );
}
