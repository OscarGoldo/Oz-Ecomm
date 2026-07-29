import { Gift } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { ReferralReview } from "@/components/admin/referral-review";
import { requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REFERRAL_STATUS_META,
  REWARD_CAP_PER_30D,
  REWARD_CAP_WINDOW_DAYS,
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

export default async function SuperReferidosPage() {
  await requireSuperAdmin();

  const db = createAdminClient();
  const { data } = await db
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  const referrals = (data ?? []) as Referral[];

  const storeIds = [
    ...new Set(referrals.flatMap((r) => [r.referrer_store_id, r.referred_store_id])),
  ];
  const { data: stores } = storeIds.length
    ? await db.from("stores").select("id, name, slug").in("id", storeIds)
    : { data: [] };
  const byId = new Map((stores ?? []).map((s) => [s.id, s]));

  const queue = referrals.filter((r) => r.status === "qualified");
  const rest = referrals.filter((r) => r.status !== "qualified");

  const day = (iso: string) =>
    format(new Date(iso), "d MMM yyyy", { locale: es });

  const Row = ({ r }: { r: Referral }) => {
    const referrer = byId.get(r.referrer_store_id);
    const referred = byId.get(r.referred_store_id);
    const meta = REFERRAL_STATUS_META[r.status];
    return (
      <li className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              {referrer?.name ?? "—"}{" "}
              <span className="text-muted-foreground">trajo a</span>{" "}
              {referred?.name ?? "—"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {day(r.created_at)} · código {r.code_used} · +{r.reward_months} mes
              {r.signup_ip ? ` · IP ${r.signup_ip}` : ""}
            </p>
            {r.note && (
              <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
            )}
          </div>
          <Badge variant={STATUS_VARIANT[r.status]}>{meta.label}</Badge>
        </div>
        {(r.status === "qualified" || r.status === "pending") && (
          <div className="mt-3">
            <ReferralReview referralId={r.id} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referidos</h1>
        <p className="text-sm text-muted-foreground">
          Los premios se acreditan solos hasta {REWARD_CAP_PER_30D} por tienda
          cada {REWARD_CAP_WINDOW_DAYS} días. Lo que pasa ese tope cae aquí.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Esperando decisión ({queue.length})
        </h2>
        {queue.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <Gift className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nada pendiente. Los referidos válidos se están acreditando solos.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {queue.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historial ({rest.length})
        </h2>
        {rest.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Todavía no hay referidos.
          </p>
        ) : (
          <ul className="space-y-2">
            {rest.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
