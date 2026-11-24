import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function audit(
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ip?: string | null;
  },
  tx: Prisma.TransactionClient = db,
) {
  try {
    await tx.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
