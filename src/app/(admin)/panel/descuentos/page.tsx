import { CouponsManager } from "@/components/admin/coupons-manager";
import { requireStoreUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/database";

export const metadata = { title: "Descuentos" };

export default async function DescuentosPage() {
  const { store } = await requireStoreUser();
  const supabase = createClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Descuentos</h1>
        <p className="text-sm text-muted-foreground">
          Cupones de descuento que tus clientes ingresan en el checkout.
        </p>
      </div>
      <CouponsManager initial={(coupons ?? []) as Coupon[]} />
    </div>
  );
}
