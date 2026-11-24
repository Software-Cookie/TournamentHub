import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { AuthModal } from "@/components/auth/auth-modal";
import { getCurrentUser, getMemberOrgIds, isAdminRole } from "@/lib/authz";
import { googleEnabled } from "@/auth";
import { isPremiumUser } from "@/server/membership";
import { PremiumModal } from "@/components/premium/premium-modal";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [orgIds, isPremium] = user ? await Promise.all([getMemberOrgIds(user.id), isPremiumUser(user.id)]) : [[], false];
  const isOrganiser = orgIds.length > 0;
  return (
    <>
      <SiteHeader user={user ? { name: user.name, email: user.email, isAdmin: isAdminRole(user.role), isOrganiser, isPremium } : null} />
      <main id="main">{children}</main>
      <SiteFooter />
      <AuthModal isAuthenticated={!!user} googleEnabled={googleEnabled} />
      <PremiumModal isAuthenticated={!!user} isPremium={isPremium} />
    </>
  );
}
