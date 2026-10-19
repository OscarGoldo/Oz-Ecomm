import { Check, Gift } from "lucide-react";

import { CopyReferralMessage, ReferralShare } from "@/components/admin/referral-share";
import { requireStoreUser } from "@/lib/auth";
import { isPro } from "@/lib/plans";
import {
  QUALIFY_MIN_ORDERS,
  QUALIFY_MIN_PRODUCTS,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_STATUS_META,
  REWARD_CAP_PER_30D,
  REWARD_CAP_WINDOW_DAYS,
  monthsEarned,
  referralLink,
  referralShareText,
} from "@/lib/referrals";
import { createAdminClient } from "@/lib/supabase/admin";
import { shortAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import type { Referral, ReferralStatus } from "@/types/database";

export const metadata = { title: "Referidos" };

const STATUS_CHIP: Record<ReferralStatus, string> = {
  pending: "bg-[#E0F2FE] text-[#075985]",
  qualified: "bg-[#FFF4D6] text-[#7A5200]",
  rewarded: "bg-[#DCFCE7] text-[#166534]",
  rejected: "bg-[#F3F1EC] text-[#6B5E45]",
};

const LOGOS = [
  "bg-[#FCE7EF] text-[#B8476E]",
  "bg-[#E0F2FE] text-[#0369A1]",
  "bg-[#ECEAFB] text-[#3E2F9E]",
  "bg-[#FFEDE3] text-[#A8401A]",
  "bg-[#DCF5EA] text-[#11755A]",
];

/** Cuántas tiendas en camino se miden a la vez (dos conteos por tienda). */
const MAX_PROGRESS = 30;

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", { timeZone: "America/Caracas", day: "numeric", month: "long" }).format(new Date(iso));
}

/**
 * El programa de referidos: el link para invitar, los meses ganados y en qué
 * va cada tienda invitada (cuántos productos publicó, si ya vendió).
 */
export default async function ReferidosPage() {
  const { store } = await requireStoreUser();

  const header = (
    <header>
      <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
        Negocio · referidos
      </p>
      <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Referidos</h1>
      <p className="mt-1.5 text-[15px] text-ink-600">
        Invita a otro emprendedor y gana un mes de Pro cuando su tienda arranque.
      </p>
    </header>
  );

  // Entre que se despliega el código y se corre la migración 0020 hay una
  // ventana donde la columna todavía no existe. Mejor un cartel que un 500.
  if (!store.referral_code) {
    return (
      <div className="space-y-5">
        {header}
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <Gift className="mb-3 size-9 text-ink-400" />
          <p className="font-medium">Estamos activando los referidos</p>
          <p className="mt-1 text-sm text-ink-500">
            En breve vas a poder invitar a otros emprendedores y ganar meses de Pro.
          </p>
        </div>
      </div>
    );
  }

  // Service role a propósito: hay que leer el NOMBRE y el avance de las
  // tiendas referidas, y las policies no cubren leer tiendas ajenas. El filtro
  // por referrer_store_id es lo que acota el alcance.
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

  // Las que siguen en camino: cuánto les falta. Los mismos conteos que usa
  // `maybeQualifyReferral` para dar el premio.
  const pendingIds = referrals.filter((r) => r.status === "pending").slice(0, MAX_PROGRESS).map((r) => r.referred_store_id);
  const progress = new Map<string, { products: number; orders: number }>();
  await Promise.all(
    pendingIds.map(async (id) => {
      const [{ count: products }, { count: orders }] = await Promise.all([
        db.from("products").select("id", { count: "exact", head: true }).eq("store_id", id).eq("status", "active"),
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", id)
          .not("confirmed_at", "is", null)
          .neq("status", "cancelled"),
      ]);
      progress.set(id, { products: products ?? 0, orders: orders ?? 0 });
    }),
  );

  const now = Date.now();
  const months = monthsEarned(referrals);
  const valid = referrals.filter((r) => r.status !== "rejected");
  const credited = referrals.filter((r) => r.status === "rewarded").length;
  const onTheWay = referrals.filter((r) => r.status === "pending" || r.status === "qualified").length;
  const lifetime = store.plan === "pro" && !store.plan_expires_at;
  const link = referralLink(store.referral_code);
  const cookieDays = Math.round(REFERRAL_COOKIE_MAX_AGE / 86_400);

  const planLine = lifetime
    ? "Tienes Pro de por vida, así que no hay meses que sumar; igual llevamos la cuenta de las tiendas que traes."
    : isPro(store) && store.plan_expires_at
      ? `Tu Pro vence el ${longDate(store.plan_expires_at)}. Cada tienda que arranque le suma un mes más.`
      : "Cada tienda que arranque te da un mes de Pro.";

  const steps = [
    { title: "Compartes tu link", text: "Por WhatsApp, en tus historias o donde hables con otros emprendedores." },
    { title: "Crea su tienda", text: `Si se registra desde tu link en los próximos ${cookieDays} días, queda asociada a ti.` },
    {
      title: `Publica ${QUALIFY_MIN_PRODUCTS} productos`,
      text: "Así sabemos que la tienda es de verdad y no una cuenta de prueba.",
    },
    {
      title: QUALIFY_MIN_ORDERS === 1 ? "Confirma su primera venta" : `Confirma ${QUALIFY_MIN_ORDERS} ventas`,
      text: "Y te sumamos un mes de Pro al final de tu período.",
      last: true,
    },
  ];

  return (
    <div className="space-y-5">
      {header}

      <section className="flex flex-wrap items-center gap-6 rounded-[20px] bg-noche p-5 text-white sm:gap-7 sm:p-7">
        <div className="flex min-w-0 flex-[1.4_1_340px] flex-col gap-3.5">
          <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-niebla">
            Tu link para invitar
          </p>
          <ReferralShare code={store.referral_code} link={link} />
        </div>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-2xl bg-noche-suave p-[18px]">
          <p className="text-sm text-[#D7E1EB]">Llevas ganados</p>
          <p className="-mt-1 font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]">
            {months} {months === 1 ? "mes" : "meses"} <span className="text-lg font-bold text-niebla">de Pro</span>
          </p>
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {Array.from({ length: Math.min(months, 6) }, (_, i) => (
              <span key={`m${i}`} className="grid h-[46px] w-10 place-items-center rounded-[11px] bg-sol text-noche">
                <Check className="size-4" strokeWidth={3} />
              </span>
            ))}
            {months > 6 && (
              <span className="grid h-[46px] w-10 place-items-center rounded-[11px] bg-sol font-landing-mono text-xs font-bold text-noche">
                +{months - 6}
              </span>
            )}
            {Array.from({ length: Math.min(onTheWay, 3) }, (_, i) => (
              <span
                key={`p${i}`}
                className="grid h-[46px] w-10 place-items-center rounded-[11px] border-[1.5px] border-dashed border-white/30 font-landing-mono text-[10px] font-semibold uppercase text-niebla"
              >
                Pronto
              </span>
            ))}
          </div>
          <p className="text-[13px] leading-[1.45] text-niebla">{planLine}</p>
        </div>
      </section>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border bg-card p-4",
              s.last && "border-[#F5DE7A] bg-[#FFFBEB]",
            )}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full bg-[#EEF3F8] font-landing-mono text-[12.5px] font-semibold",
                s.last && "bg-sol",
              )}
            >
              {i + 1}
            </span>
            <b className="text-[15px]">{s.title}</b>
            <span className={cn("text-[13px] leading-[1.45] text-ink-500", s.last && "text-[#6B5300]")}>{s.text}</span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section aria-labelledby="invitadas" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-[18px] pb-3 pt-4">
            <h2 id="invitadas" className="font-display text-lg font-extrabold tracking-[-0.02em]">
              Las tiendas que invitaste
            </h2>
            {valid.length > 0 && (
              <span className="text-[13px] text-ink-500">
                {valid.length} {valid.length === 1 ? "tienda" : "tiendas"} · {credited}{" "}
                {credited === 1 ? "acreditada" : "acreditadas"} · {onTheWay} en camino
              </span>
            )}
          </div>
          {referrals.length === 0 ? (
            <div className="border-t border-[#EEF3F8] px-6 py-10 text-center">
              <p className="font-medium">Todavía no invitaste a nadie</p>
              <p className="mt-1 text-sm text-ink-500">
                Comparte tu link con otro emprendedor y empieza a sumar meses.
              </p>
            </div>
          ) : (
            <ul className="border-t border-[#EEF3F8]">
              {referrals.map((r, n) => {
                const name = nameById.get(r.referred_store_id) ?? "Tienda";
                const p = progress.get(r.referred_store_id);
                const productsOk = r.status !== "pending" || (p?.products ?? 0) >= QUALIFY_MIN_PRODUCTS;
                const salesOk = r.status !== "pending" || (p?.orders ?? 0) >= QUALIFY_MIN_ORDERS;
                const segs = [true, r.status === "rejected" ? false : productsOk, r.status === "rejected" ? false : salesOk];
                const done = r.status === "rewarded" || r.status === "qualified";
                let line: string;
                if (r.status === "pending") {
                  line = !p
                    ? REFERRAL_STATUS_META.pending.description
                    : (p.products < QUALIFY_MIN_PRODUCTS
                        ? `Lleva ${p.products} de ${QUALIFY_MIN_PRODUCTS} productos publicados`
                        : "Ya publicó sus productos") +
                      (p.orders >= QUALIFY_MIN_ORDERS ? "" : p.products < QUALIFY_MIN_PRODUCTS ? " y todavía no vende" : ": le falta su primera venta");
                } else if (r.status === "rewarded") {
                  line = r.rewarded_at ? `Te dio un mes de Pro el ${longDate(r.rewarded_at)}` : REFERRAL_STATUS_META.rewarded.description;
                } else if (r.status === "qualified") {
                  line = "Cumplió todo: estamos revisando el premio";
                } else {
                  line = REFERRAL_STATUS_META.rejected.description;
                }
                return (
                  <li
                    key={r.id}
                    className="grid gap-3 border-t border-[#EEF3F8] px-[18px] py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_240px_auto] sm:items-center sm:gap-4"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-[11px] text-[15px] font-extrabold", LOGOS[n % LOGOS.length])} aria-hidden="true">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <b className="truncate text-[15px]">{name}</b>
                        <span className="text-[12.5px] text-ink-500">Se registró {shortAgo(r.created_at, now).toLowerCase()}</span>
                      </span>
                    </span>
                    <span className="flex flex-col gap-1.5">
                      <span className="grid grid-cols-3 gap-1" aria-hidden="true">
                        {segs.map((on, i) => (
                          <span
                            key={i}
                            className={cn("h-1.5 rounded-full bg-[#E7EFF7]", on && (done ? "bg-[#16A34A]" : "bg-brand-600"))}
                          />
                        ))}
                      </span>
                      <span className="text-[12.5px] text-pizarra">{line}</span>
                    </span>
                    <span className="sm:justify-self-end">
                      <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold", STATUS_CHIP[r.status])}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                        {REFERRAL_STATUS_META[r.status].label}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="mensaje" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <h2 id="mensaje" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              El mensaje que se comparte
            </h2>
            <p className="rounded-[14px_14px_4px_14px] bg-[#E3F6D9] px-3.5 py-3 text-[13.5px] leading-normal text-[#16301A]">
              {referralShareText(store.referral_code)}
            </p>
            <CopyReferralMessage code={store.referral_code} />
          </section>
          <section aria-labelledby="a-quien" className="flex flex-col gap-2.5 rounded-2xl border bg-card p-5">
            <h2 id="a-quien" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              A quién invitar
            </h2>
            <p className="text-[13.5px] leading-normal text-pizarra">
              A quien ya vende por Instagram o WhatsApp y anota los pedidos a mano: es quien más rápido llega a su
              primera venta, y esa es la que te da el mes.
            </p>
          </section>
          <p className="text-[12.5px] leading-normal text-ink-500">
            Hasta {REWARD_CAP_PER_30D} meses por cada {REWARD_CAP_WINDOW_DAYS} días. Los meses se suman al final de tu
            período: si pagas con renovación automática, el cobro sigue igual y tu vencimiento se corre hacia adelante.
          </p>
        </div>
      </div>
    </div>
  );
}
