import { SuperStripePanel } from "@/components/admin/super-stripe-panel";
import { requireSuperAdmin } from "@/lib/auth";

export const metadata = { title: "Stripe" };

export default async function SuperStripePage() {
  await requireSuperAdmin();
  return <SuperStripePanel />;
}
