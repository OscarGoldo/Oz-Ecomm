import { Gift, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { ReferralShare } from "@/components/admin/referral-share";
import { requireStoreUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  QUALIFY_MIN_ORDERS,
  QUALIFY_MIN_PRODUCTS,
  REFERRAL_REWARD_MONTHS,
  REFERRAL_STATUS_META,
  monthsEarned,
  referralLink,
} from "@/lib/referrals";
import type { Referral, ReferralStatus } from "@/types/database";

export const metadata = { title: "Referidos" };

const STATUS_VARIANT: Record<
  ReferralStatus,
  "neutral" | "warning" | "success" | "danger"
> = {
  pending: "neutral",
  qualified: "warning",
  rewarded: "success",
  rejected: "danger",
};

export default async function ReferidosPage() {
  const { store } = await requireStoreUser();

  // Entre que se despliega el código y se corre la migración 0020 hay una
  // ventana donde la columna todavía no existe. Mejor un cartel que un 500.
  if (!store.referral_code) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
        <Gift className="mb-3 size-9 text-muted-foreground" />
        <p className="font-medium">Estamos activando los referidos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          En breve vas a poder invitar a otros emprendedores y ganar meses de Pro.
        </p>
      </div>
    );
  }

  // Service role a propósito: hay que leer el NOMBRE de las tiendas referidas,
  // y la policy pública de `stores` no cubre traer tiendas ajenas por id. El
  // filtro por referrer_store_id es lo que acota el alcance.
  const db = createAdminClient();
  const { data } = await db
    .from("referrals")
    .select("*")
    .eq("referrer_store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const referrals = (data ?? []) as Referral[];

  const referredIds = referrals.map((r) => r.referred_store_id);
  const { data: referredStores } = referredIds.length
    ? await db.from("stores").select("id, name").in("id", referredIds)
    : { data: [] };
  const nameById = new Map((referredStores ?? []).map((s) => [s.id, s.name]));

  const months = monthsEarned(referrals);
  const activos = referrals.filter((r) => r.status !== "rejected").length;

  const ago = (iso: string) =>
    formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referidos</h1>
        <p className="text-sm text-muted-foreground">
          Invitá a otro emprendedor y ganá {REFERRAL_REWARD_MONTHS === 1 ? "un mes" : `${REFERRAL_REWARD_MONTHS} meses`} de Pro
          cuando su tienda arranque.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-1 font-semibold">Tu link para invitar</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Mandáselo a quien tenga algo para vender. Si se registra desde tu link,
          queda asociado a vos.
        </p>
        <ReferralShare
          code={store.referral_code}
          link={referralLink(store.referral_code)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tiendas que trajiste
          </p>
          <p className="mt-1 text-2xl font-bold">{activos}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Meses de Pro ganados
          </p>
          <p className="mt-1 text-2xl font-bold">{months}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <Gift className="size-4" /> Cómo se gana el mes
        </p>
        <p>
          El premio se acredita cuando la tienda que invitaste publica al menos{" "}
          {QUALIFY_MIN_PRODUCTS} productos y confirma{" "}
          {QUALIFY_MIN_ORDERS === 1 ? "su primera venta" : `${QUALIFY_MIN_ORDERS} ventas`}.
          Los meses se suman al final de tu período actual — si pagás con
          suscripción de PayPal, el cobro sigue igual y tu vencimiento se corre
          hacia adelante.
        </p>
      </div>

      {referrals.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
          <Users className="mb-3 size-9 text-muted-foreground" />
          <p className="font-medium">Todavía no invitaste a nadie</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compartí tu link con otro emprendedor y empezá a sumar meses.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {referrals.map((r) => {
            const meta = REFERRAL_STATUS_META[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {nameById.get(r.referred_store_id) ?? "Tienda"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se registró {ago(r.created_at)} · {meta.description}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[r.status]}>{meta.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
