import Link from "next/link";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Gauge,
  HandCoins,
  Lock,
  ShoppingBag,
  Store as StoreIcon,
  X,
} from "lucide-react";

import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth";
import { getCreditOverview, type CreditRow } from "@/lib/credit-server";
import {
  CREDIT_RULES,
  LEVEL_LABEL,
  usd,
  type CreditLevel,
  type Requirement,
} from "@/lib/credit-score";
import { agoShort } from "@/lib/super-format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Crédito" };

const LEVEL_BADGE: Record<CreditLevel, "neutral" | "warning" | "info" | "success"> = {
  observacion: "neutral",
  construccion: "warning",
  confiable: "info",
  solida: "success",
};

/**
 * La reputación de cada tienda, pensada para el día que Tiendify financie
 * cuotas o adelantos. Es solo para los socios: ninguna tienda ve su puntaje, y
 * nada se le ofrece sin que el comerciante lo pida y acepte los términos. El
 * cálculo y sus reglas viven en `lib/credit-score.ts`.
 */
export default async function SuperCreditPage() {
  await requireSuperAdmin();
  const { rows, excluded } = await getCreditOverview();
  const now = new Date();

  const selling = rows.filter((r) => r.now.metrics.lastSaleAt !== null);
  const idle = rows.filter((r) => r.now.metrics.lastSaleAt === null);
  const installments = rows.filter((r) => r.now.installments.eligible).length;
  const advances = rows.filter((r) => r.now.advance.eligible).length;
  const best = selling[0];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crédito</h1>
        <p className="text-sm text-muted-foreground">
          La reputación de cada tienda, para el día que financiemos cuotas o
          adelantos.
        </p>
      </div>

      <p className="flex gap-2.5 rounded-xl border border-border bg-card p-3.5 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-400" />
        <span>
          <span className="font-medium">Interno.</span> Ninguna tienda ve su
          puntaje. Antes de ofrecerle cuotas o un adelanto, el comerciante tiene
          que pedirlo y aceptar los términos. Los montos de abajo son lo que
          calificaría hoy, no ofertas.
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<StoreIcon className="size-4" />}
          label="Tiendas que venden"
          value={String(selling.length)}
          sub={`de ${rows.length} evaluadas`}
        />
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Podrían vender a cuotas"
          value={String(installments)}
          sub={`desde ${CREDIT_RULES.installments.minScore} puntos y ${CREDIT_RULES.installments.minDaysSelling} días`}
        />
        <StatCard
          icon={<HandCoins className="size-4" />}
          label="Podrían recibir adelanto"
          value={String(advances)}
          sub={`desde ${CREDIT_RULES.advance.minScore} puntos y ${CREDIT_RULES.advance.minDaysSelling} días`}
        />
        <StatCard
          icon={<Gauge className="size-4" />}
          label="Puntaje más alto"
          value={best ? String(best.now.score) : "—"}
          sub={best ? best.store.name : "Nadie vende todavía"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tiendas con ventas</h2>
        {selling.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="text-sm font-medium">Ninguna tienda ha vendido todavía</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {selling.map((r) => (
              <StoreCredit key={r.store.id} row={r} />
            ))}
          </ul>
        )}
      </section>

      {idle.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Sin ventas todavía{" "}
            <span className="font-normal text-muted-foreground">({idle.length})</span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {idle.map((r) => (
              <li key={r.store.id}>
                <Link
                  href={`/super/tiendas/${r.store.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:border-ink-300"
                >
                  <span className="font-medium">{r.store.name}</span>
                  <span className="text-muted-foreground">
                    creada {agoShort(r.store.created_at, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HowItWorks rows={rows} />

      {excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No se evalúan las tiendas de prueba: {excluded.join(", ")}.
        </p>
      )}
    </div>
  );
}

function StoreCredit({ row }: { row: CreditRow }) {
  const { store, now: c, before } = row;
  const m = c.metrics;
  const change = c.score - before.score;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-3.5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1 basis-56">
            <p className="truncate font-semibold">{store.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Vende hace {m.daysSelling} d · {usd(m.sales6m)} en 6 meses ·{" "}
              {m.salesCount6m} {m.salesCount6m === 1 ? "venta" : "ventas"}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <ModelBadge label="Cuotas" ok={c.installments.eligible} />
            <ModelBadge label="Adelanto" ok={c.advance.eligible} />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-display text-2xl font-semibold leading-none tabular-nums">
                {c.score}
                <span className="text-xs font-normal text-ink-400">/100</span>
              </p>
              <p className="mt-1 text-2xs text-ink-500">
                {change === 0
                  ? "igual que hace 30 d"
                  : `${change > 0 ? "+" : "−"}${Math.abs(change)} en 30 d`}
              </p>
            </div>
            <Badge variant={LEVEL_BADGE[c.level]}>{LEVEL_LABEL[c.level]}</Badge>
            <ChevronDown className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="space-y-4 border-t border-border p-3.5">
          {(c.blockers.length > 0 || c.notices.length > 0) && (
            <ul className="space-y-1.5">
              {c.blockers.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-destructive-text">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {b}
                </li>
              ))}
              {c.notices.map((n) => (
                <li key={n} className="flex gap-2 text-sm text-muted-foreground">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {n}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">
                De dónde sale el puntaje
              </h3>
              {c.parts.map((p) => (
                <div key={p.key}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{p.label}</span>
                    <span className="tabular-nums text-ink-500">
                      {p.points}/{p.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${(p.points / p.max) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <ModelBlock
                title="Vender a cuotas"
                eligible={c.installments.eligible}
                requirements={c.installments.requirements}
                outcome={
                  c.installments.monthlyCapacity > 0
                    ? `Hasta ${usd(c.installments.monthlyCapacity)} al mes en ventas a cuotas. El fondo pondría unos ${usd(c.installments.fundExposure)}: lo que queda después de la inicial del ${Math.round(CREDIT_RULES.installments.downPayment * 100)}%.`
                    : null
                }
              />
              <ModelBlock
                title="Adelanto de ventas"
                eligible={c.advance.eligible}
                requirements={c.advance.requirements}
                outcome={
                  c.advance.amount > 0 && c.advance.months !== null
                    ? `${usd(c.advance.amount)}, devuelve ${usd(c.advance.repay)} con el ${Math.round(CREDIT_RULES.advance.holdback * 100)}% de cada venta: unos ${Math.ceil(c.advance.months)} meses al ritmo de hoy.`
                    : null
                }
              />
            </div>
          </div>

          <p className="text-2xs text-ink-400">
            <Link href={`/super/tiendas/${store.id}`} className="underline">
              Ver la ficha de la tienda
            </Link>
          </p>
        </div>
      </details>
    </li>
  );
}

function ModelBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge variant={ok ? "success" : "neutral"}>
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </Badge>
  );
}

function ModelBlock({
  title,
  eligible,
  requirements,
  outcome,
}: {
  title: string;
  eligible: boolean;
  requirements: Requirement[];
  outcome: string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={cn(
            "text-xs font-medium",
            eligible ? "text-success-text" : "text-muted-foreground",
          )}
        >
          {eligible ? "Calificaría" : "Todavía no"}
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {requirements.map((r) => (
          <li key={r.label} className="flex items-start gap-2 text-xs">
            {r.ok ? (
              <Check className="mt-px size-3.5 shrink-0 text-success-text" />
            ) : (
              <X className="mt-px size-3.5 shrink-0 text-ink-400" />
            )}
            <span className={cn(!r.ok && "text-muted-foreground")}>
              {r.label} <span className="text-ink-400">· {r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {eligible && outcome && (
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs">{outcome}</p>
      )}
    </div>
  );
}

/** Las reglas, sacadas del mismo cálculo para que la explicación no se desfase. */
function HowItWorks({ rows }: { rows: CreditRow[] }) {
  const parts = rows[0]?.now.parts ?? [];
  const ir = CREDIT_RULES.installments;
  const ar = CREDIT_RULES.advance;

  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Cómo se calcula
        <ChevronDown className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-3.5 text-sm">
        <p className="text-muted-foreground">
          Casi todas las ventas las confirma el propio comerciante, así que pesa
          más lo difícil de inventar: vender todos los meses, muchos compradores
          distintos que vuelven, y lo cobrado con tarjeta por Tiendify. Las
          compras con el teléfono o el correo de la propia tienda no cuentan. Un
          «mes» son 30 días hacia atrás.
        </p>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {parts.map((p) => (
            <li key={p.key} className="flex justify-between gap-3 border-b border-border py-1">
              <span>{p.label}</span>
              <span className="tabular-nums text-ink-500">{p.max} pts</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-medium">Vender a cuotas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El comprador paga una inicial del {Math.round(ir.downPayment * 100)}% y
              el resto en cuotas; el fondo le adelanta a la tienda lo que falta.
              Pide {ir.minScore} puntos, {ir.minDaysSelling} días vendiendo, ventas
              en {ir.minMonthsWithSales} de 6 meses y {ir.minBuyers} compradores
              distintos. Cupo: el {Math.round(ir.capacityShare * 100)}% de lo que
              vende al mes, hasta {usd(ir.capacityCap)}.
            </p>
          </div>
          <div>
            <p className="font-medium">Adelanto de ventas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El fondo le adelanta hasta un mes de ventas (máximo {usd(ar.cap)}) y
              lo recupera con el {Math.round(ar.holdback * 100)}% de cada venta,
              más un cargo fijo del {Math.round(ar.fee * 100)}%. Pide{" "}
              {ar.minScore} puntos, {ar.minDaysSelling} días vendiendo, ventas en{" "}
              {ar.minMonthsWithSales} de 6 meses, {usd(ar.minAvgMonthly)} al mes y
              ventas que no caigan más de {Math.round((1 - ar.minTrendRatio) * 100)}%.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Bloquea cualquiera de los dos: tienda pausada, {CREDIT_RULES.maxDaysSinceSale}{" "}
          días sin vender, o un solo comprador con más del{" "}
          {Math.round(CREDIT_RULES.maxTopBuyerShare * 100)}% de lo vendido.
        </p>
      </div>
    </details>
  );
}
