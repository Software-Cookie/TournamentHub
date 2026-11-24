import type { Metadata } from "next";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { requireAdmin } from "@/lib/authz";

export const metadata: Metadata = { title: { default: "Platform admin", template: "%s · Admin · TournamentHub" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Platform overview", icon: "BarChart3", exact: true },
  { href: "/admin/organisers", label: "Organisers & payouts", icon: "Building2" },
  { href: "/admin/sports", label: "Sports & pricing", icon: "Tags" },
  { href: "/manage/tournaments", label: "All tournaments", icon: "Trophy" },
  { href: "/admin/payments", label: "Payments", icon: "CreditCard" },
  { href: "/admin/users", label: "Users", icon: "Users" },
  { href: "/admin/audit", label: "Audit log", icon: "ScrollText" },
];

// Note: every page under /admin repeats requireAdmin() — layouts are not a security boundary.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <DashboardShell nav={NAV} user={user} title="Platform admin" accent="accent" footerLink={{ href: "/manage", label: "Organiser console →" }}>
      {children}
    </DashboardShell>
  );
}
