import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { requireStoreUser } from "@/lib/auth";
import { paypalEnabled } from "@/lib/paypal";
import { getStoreSetup } from "@/lib/store-setup";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/database";

export const metadata = { title: "Métodos de pago" };

export default async function PagosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const [{ data: methods }, setup] = await Promise.all([
    supabase
      .from("payment_methods")
      .select("*")
      .eq("store_id", store.id)
      .order("display_order"),
    getStoreSetup(store),
  ]);

  // Con PayPal escondido, el método ni se lista ni se puede agregar. Queda
  // intacto en la base: guarda los datos de cobro del comerciante, y el día que
  // se prenda PayPal reaparece tal cual estaba.
  const showPaypal = paypalEnabled();
  const visible = ((methods ?? []) as PaymentMethod[]).filter(
    (m) => showPaypal || m.type !== "paypal",
  );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="min-w-0">
        <PaymentMethodsManager initial={visible} paypalEnabled={showPaypal} />
      </div>
      <aside className="min-w-0">
        <SetupChecklist items={setup.checklist} />
      </aside>
    </div>
  );
}
