import { CouponsManager } from "@/components/admin/coupons-manager";
import { ProUpsell } from "@/components/admin/pro-lock";
import { requireStoreUser } from "@/lib/auth";
import { isPro } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/database";

export const metadata = { title: "Descuentos" };

export default async function DescuentosPage() {
  const { store } = await requireStoreUser();
  const pro = isPro(store);

  const { data: coupons } = pro
    ? await createClient()
        .from("coupons")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Descuentos</h1>
        <p className="text-sm text-muted-foreground">
          Cupones de descuento que tus clientes ingresan en el checkout.
        </p>
      </div>
      {pro ? (
        <CouponsManager initial={(coupons ?? []) as Coupon[]} />
      ) : (
        <ProUpsell
          title="Los cupones son del plan Pro"
          text="Creá códigos de descuento por porcentaje, monto fijo o envío gratis, con vigencia y límite de usos. Si ya tenías cupones creados, siguen guardados y vuelven a funcionar al activar Pro."
        />
      )}
    </div>
  );
}
