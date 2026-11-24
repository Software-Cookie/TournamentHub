import type { Metadata } from "next";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { isAdminRole, requireManager } from "@/lib/authz";

export const metadata: Metadata = { title: { default: "Organiser console", template: "%s · Organiser · TournamentHub" }, robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/manage", label: "Overview", icon: "BarChart3", exact: true },
  { href: "/manage/tournaments", label: "Tournaments", icon: "Trophy" },
  { href: "/manage/matches", label: "Match control", icon: "MonitorPlay" },
  { href: "/manage/payments", label: "Revenue", icon: "Wallet" },
  { href: "/manage/notifications", label: "Announcements", icon: "Bell" },
  { href: "/manage/scan", label: "Ticket scanner", icon: "ScanLine" },
  { href: "/manage/settings", label: "Organiser profile", icon: "Settings" },
];

// Note: every page under /manage repeats its own authorisation check — layouts are not a security boundary.
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await requireManager();
  return (
    <DashboardShell nav={NAV} user={user} title="Organiser console" accent="accent" footerLink={isAdminRole(user.role) ? { href: "/admin", label: "Platform admin →" } : { href: "/dashboard", label: "← Player dashboard" }}>
      {children}
    </DashboardShell>
  );
}
