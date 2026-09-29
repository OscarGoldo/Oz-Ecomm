import { ConfigTabs } from "@/components/admin/config-tabs";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMethod } from "@/types/database";

export const metadata = { title: "Métodos de pago" };

export default async function PagosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const { data: methods } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("store_id", store.id)
    // PayPal se quitó en septiembre de 2026. Los métodos viejos quedan en la
    // base (guardan los datos de cobro de ventas pasadas), pero no se muestran:
    // reactivarlos no haría nada, porque ya no hay con qué cobrarlos.
    .neq("type", "paypal")
    .order("display_order");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <ConfigTabs />
      <PaymentMethodsManager initial={(methods ?? []) as PaymentMethod[]} />
    </div>
  );
}
