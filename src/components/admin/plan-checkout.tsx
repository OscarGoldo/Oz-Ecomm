"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Send,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { PlanPaypalButtons } from "@/components/admin/plan-paypal-buttons";
import { PlanSubscribeButtons } from "@/components/admin/plan-subscribe-buttons";
import {
  createProStripeCheckout,
  requestProUpgrade,
  type UpgradeInput,
} from "@/app/(admin)/panel/plan/actions";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import {
  PLAN_PERIODS,
  freeMonths,
  priceFor,
  savingPct,
  type PlanPrices,
} from "@/lib/plans";
import type { SubscriptionMethod } from "@/types/database";
import { cn } from "@/lib/utils";

export interface PlatformPaymentView {
  method: SubscriptionMethod;
  label: string;
  fields: { label: string; value: string }[];
}

/** Cómo va a pagar: online (tarjeta o PayPal), o manual subiendo comprobante. */
type PayVia = "stripe" | "paypal" | "manual";

/** Los métodos que se pagan por fuera y llevan comprobante. */
type ManualMethod = UpgradeInput["method"];

/**
 * El checkout del plan Pro.
 *
 * Primero se elige CÓMO se paga y recién después el período, y no al revés,
 * porque la forma de pago es la que decide qué se está contratando: con tarjeta
 * es una suscripción que se cobra sola, con comprobante es un pago que se vence.
 * Con el período primero, "1 mes" significaba dos cosas distintas según el
 * botón que se tocara después, y la diferencia se explicaba en una línea gris
 * debajo de todo. Ahora cada elección cambia el resumen "Así funciona", que
 * contesta lo que de verdad se pregunta quien va a pagar: cuánto, cuándo se
 * activa, qué pasa después y cómo se deja.
 */
export function PlanCheckout({
  renewing = false,
  storeId,
  prices,
  payments,
  bcvRate,
  paypalClientId,
  planIds,
  stripeEnabled,
  stripeRecurringPeriods,
}: {
  /** Ya es Pro y está pagando otro período: el título dice "Renovar". */
  renewing?: boolean;
  storeId: string;
  prices: PlanPrices;
  payments: PlatformPaymentView[];
  /** Tasa BCV para mostrar el monto en Bs. null = solo USD. */
  bcvRate: number | null;
  /** Client id público de PayPal. null = PayPal no configurado. */
  paypalClientId: string | null;
  /**
   * Ids de los planes de facturación de PayPal, por período. Un período que
   * no está acá se cobra una sola vez y no se renueva.
   */
  planIds: Partial<Record<number, string>> | null;
  /** ¿Está Stripe configurado en la plataforma? */
  stripeEnabled: boolean;
  /**
   * Períodos que tienen precio recurrente en Stripe. Los que no están se
   * cobran una sola vez.
   */
  stripeRecurringPeriods: number[];
}) {
  const router = useRouter();
  const [months, setMonths] = useState<number>(12);
  // Lo que se activa solo va primero: tarjeta, después PayPal. El comprobante
  // queda para quien paga en Bs.
  const [via, setVia] = useState<PayVia>(
    stripeEnabled ? "stripe" : paypalClientId ? "paypal" : "manual",
  );
  const [method, setMethod] = useState<ManualMethod | null>(
    (payments[0]?.method as ManualMethod | undefined) ?? null,
  );
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const amount = priceFor(months, prices);
  const amountBs = usdToBs(amount, bcvRate);
  const selected = payments.find((p) => p.method === method);
  const nothingConfigured =
    payments.length === 0 && !paypalClientId && !stripeEnabled;
  const yearly = months >= 12;

  /**
   * ¿Ese período, pagado de esa forma, se renueva solo? Sale de lo que está
   * creado de verdad en Stripe y en PayPal, no de una suposición: un período
   * sin precio recurrente se cobra una vez aunque se pague con tarjeta.
   */
  function renewsWith(v: PayVia, m: number): boolean {
    if (v === "stripe") return stripeRecurringPeriods.includes(m);
    if (v === "paypal") return Boolean(planIds?.[m]);
    return false;
  }
  const renews = renewsWith(via, months);
  const viaRenews = (v: PayVia) => PLAN_PERIODS.every((m) => renewsWith(v, m));
  const recurringPlanId = planIds?.[months] ?? null;

  /**
   * Stripe cobra en una página suya, así que esto es una ida sin vuelta: el
   * plan lo activa el webhook cuando el cobro entra, no este clic.
   */
  async function goToStripe() {
    setRedirecting(true);
    const res = await createProStripeCheckout(months);
    if (!res.ok || !res.url) {
      setRedirecting(false);
      return toast.error(res.error ?? "No se pudo iniciar el pago");
    }
    window.location.href = res.url;
  }

  async function submit() {
    if (!method) return toast.error("Elige cómo pagaste");
    if (!proof) return toast.error("Sube la foto del comprobante");

    setSending(true);
    const res = await requestProUpgrade({
      period_months: months,
      method,
      reference,
      proof_path: proof,
    });
    setSending(false);

    if (!res.ok) return toast.error(res.error ?? "No se pudo enviar");
    toast.success("Comprobante enviado", {
      description: "Te activamos el plan Pro apenas lo confirmemos.",
    });
    router.refresh();
  }

  const vias: { id: PayVia; icon: LucideIcon; title: string; sub: string }[] = [
    ...(stripeEnabled
      ? [
          {
            id: "stripe" as const,
            icon: CreditCard,
            title: "Tarjeta",
            sub: viaRenews("stripe") ? "Se renueva sola" : "Se activa al instante",
          },
        ]
      : []),
    ...(paypalClientId
      ? [
          {
            id: "paypal" as const,
            icon: Wallet,
            title: "PayPal",
            sub: viaRenews("paypal") ? "Se renueva sola" : "Se activa al instante",
          },
        ]
      : []),
    ...(payments.length > 0
      ? [
          {
            id: "manual" as const,
            icon: Landmark,
            title: payments.map((p) => p.label).join(", "),
            sub: "Pagas cada vez",
          },
        ]
      : []),
  ];

  // Con una sola forma de pago no hay nada que elegir en el paso 1, así que
  // los números de los pasos se corren.
  const choosesVia = vias.length > 1;
  const stepPeriod = choosesVia ? 2 : 1;

  const every = yearly ? "año" : "mes";
  const lasts = yearly ? "1 año" : "1 mes";

  // JSX en variables, no en componentes anidados: un componente definido aquí
  // adentro cambia de identidad en cada render y React lo remontaría, con lo
  // que el input de referencia perdería el foco en cada tecla.
  const manualPayment = (
    <>
      <div className="space-y-2.5">
        <StepLabel n={stepPeriod + 1}>¿Por dónde vas a pagar?</StepLabel>
        <div className="flex flex-wrap gap-1.5">
          {payments.map((p) => (
            <button
              key={p.method}
              type="button"
              onClick={() => setMethod(p.method as ManualMethod)}
              aria-pressed={method === p.method}
              className={cn(
                "h-9 rounded-[9px] border px-3.5 text-[13.5px] font-semibold transition-colors",
                method === p.method
                  ? "border-noche bg-noche text-white"
                  : "bg-card text-ink-600 hover:border-ink-300 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="overflow-hidden rounded-xl border">
          <p className="border-b bg-ink-25 px-3.5 py-2.5 font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Paga a estos datos
          </p>
          <div className="divide-y divide-ink-100">
            {selected.fields.map((f) => (
              <CopyRow key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <StepLabel n={stepPeriod + 2}>Sube el comprobante</StepLabel>
        <PaymentProofUpload
          storeId={storeId}
          folder="subs"
          value={proof}
          onChange={setProof}
          label="Subir foto del comprobante"
          hint="Lo revisamos y activamos tu plan."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ref" className="text-[13px]">
          Número de referencia <span className="font-normal text-ink-500">(opcional)</span>
        </Label>
        <Input
          id="ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Últimos dígitos de la referencia"
          maxLength={120}
          className="font-landing-mono"
        />
      </div>

      <Button onClick={submit} disabled={sending} size="lg" className="w-full">
        {sending ? (
          <>
            <Loader2 className="animate-spin" /> Enviando…
          </>
        ) : (
          <>
            <Send /> Enviar comprobante
          </>
        )}
      </Button>
    </>
  );

  const stripePayment = (
    <div className="space-y-2">
      <Button className="w-full" size="lg" onClick={goToStripe} disabled={redirecting}>
        {redirecting ? (
          <>
            <Loader2 className="animate-spin" /> Abriendo el pago…
          </>
        ) : (
          <>
            <CreditCard />{" "}
            {renews
              ? `Suscribirme por ${formatUSD(amount)} al ${every}`
              : `Pagar ${formatUSD(amount)} con tarjeta`}
          </>
        )}
      </Button>
      <p className="text-center text-[13px] text-ink-600">
        Pago seguro con Stripe. No necesitas cuenta.
      </p>
    </div>
  );

  const paypalPayment = paypalClientId && (
    <div className="space-y-2">
      {recurringPlanId ? (
        <PlanSubscribeButtons
          clientId={paypalClientId}
          planId={recurringPlanId}
          storeId={storeId}
          onSubscribed={() => router.refresh()}
        />
      ) : (
        <PlanPaypalButtons
          clientId={paypalClientId}
          months={months}
          onPaid={() => router.refresh()}
        />
      )}
      <p className="text-center text-[13px] text-ink-600">
        Puedes pagar con tarjeta de débito o crédito sin tener cuenta de PayPal.
      </p>
    </div>
  );

  return (
    <section aria-labelledby="activar-pro" className="rounded-2xl border bg-card">
      <div className="border-b px-5 py-4">
        <h2 id="activar-pro" className="font-display text-lg font-bold tracking-[-0.02em]">
          {renewing ? "Renovar Pro" : "Activar Pro"}
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-600">
          Elige cómo pagar y por cuánto tiempo.
        </p>
      </div>
      <div className="space-y-6 p-5">
        {nothingConfigured ? (
          <p className="rounded-xl border border-warning-border bg-warning-surface p-3.5 text-sm text-warning-text">
            Todavía no hay métodos de pago configurados. Escríbenos para activar
            tu plan.
          </p>
        ) : (
          <>
            {/* 1. Cómo paga */}
            {choosesVia && (
              <div className="space-y-2.5">
                <StepLabel n={1}>¿Cómo quieres pagar?</StepLabel>
                <div
                  className={cn(
                    "grid gap-2",
                    vias.length >= 3 ? "sm:grid-cols-3" : "grid-cols-2",
                  )}
                >
                  {vias.map((v) => (
                    <ViaTab
                      key={v.id}
                      active={via === v.id}
                      onClick={() => setVia(v.id)}
                      icon={v.icon}
                      title={v.title}
                      sub={v.sub}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 2. Período */}
            <div className="space-y-2.5">
              <StepLabel n={stepPeriod}>
                {viaRenews(via) ? "¿Cada cuánto se cobra?" : "¿Por cuánto tiempo?"}
              </StepLabel>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_PERIODS.map((m) => {
                  const total = priceFor(m, prices);
                  const auto = renewsWith(via, m);
                  const year = m >= 12;
                  // El anual se cuenta en "meses gratis" porque es como se
                  // entiende de un vistazo. Y si el precio no trae descuento,
                  // no se anuncia ninguno.
                  const free = freeMonths(m, prices);
                  const pct = savingPct(m, prices);
                  const badge =
                    free > 0
                      ? `${free} ${free === 1 ? "mes" : "meses"} gratis`
                      : pct > 0
                        ? `ahorras ${pct}%`
                        : null;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      aria-pressed={months === m}
                      className={cn(
                        "relative rounded-xl border p-3.5 text-left transition-[border-color,box-shadow,background-color]",
                        months === m
                          ? "border-noche bg-ink-25 ring-1 ring-noche"
                          : "bg-card hover:border-ink-300",
                      )}
                    >
                      <p className="text-[13px] font-semibold text-ink-600">
                        {auto ? (year ? "Anual" : "Mensual") : year ? "1 año" : "1 mes"}
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold leading-none tracking-[-0.03em] tabular-nums">
                        {formatUSD(total)}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-500">
                        {auto ? (year ? "por año" : "por mes") : "un solo pago"}
                      </p>
                      {badge && (
                        <span className="mt-2 inline-flex rounded-md border border-success-border bg-success-surface px-1.5 py-0.5 text-[11px] font-semibold text-success-text">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Así funciona */}
            <div className="rounded-xl border bg-ink-25 p-4">
              <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                Así funciona
              </p>
              <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-ink-600">Hoy pagas</dt>
                <dd>
                  <span className="font-landing-mono text-lg font-semibold leading-none tabular-nums">
                    {formatUSD(amount)}
                  </span>
                  {via === "manual" && amountBs !== null && (
                    <span className="mt-1 block font-landing-mono text-xs text-ink-500">
                      {formatBs(amountBs)} · tasa BCV de hoy
                    </span>
                  )}
                </dd>

                <dt className="text-ink-600">Se activa</dt>
                <dd>
                  {via === "manual"
                    ? "Cuando confirmemos tu comprobante."
                    : "Al instante."}
                </dd>

                <dt className="text-ink-600">Después</dt>
                <dd>
                  {renews
                    ? `Se cobra sola cada ${every}, sin que hagas nada.`
                    : `No se cobra nada solo. Tu Pro dura ${lasts} y los últimos 7 días te lo recordamos aquí en el panel.`}
                </dd>

                <dt className="text-ink-600">Para dejarlo</dt>
                <dd>
                  {renews
                    ? "La cancelas desde esta misma pantalla y sigues con Pro hasta el final de lo que ya pagaste."
                    : "No tienes que hacer nada: al vencer pasas a Gratis."}
                </dd>
              </dl>
            </div>

            {via === "stripe" && stripeEnabled
              ? stripePayment
              : via === "paypal" && paypalClientId
                ? paypalPayment
                : manualPayment}
          </>
        )}
      </div>
    </section>
  );
}

/** Rótulo de cada paso: el número en mono y la pregunta. */
function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-noche font-landing-mono text-[11px] text-white">
        {n}
      </span>
      {children}
    </p>
  );
}

function ViaTab({
  active,
  onClick,
  icon: Icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-3.5 text-left transition-[border-color,box-shadow,background-color]",
        active ? "border-noche bg-ink-25 ring-1 ring-noche" : "bg-card hover:border-ink-300",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          active ? "bg-noche text-white" : "bg-ink-100 text-ink-600",
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className="mt-2.5 text-sm font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-xs text-ink-500">{sub}</p>
    </button>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-24 shrink-0 text-[13px] text-ink-600">{label}</span>
      <span className="min-w-0 flex-1 truncate font-landing-mono text-sm font-semibold">
        {value}
      </span>
      <button
        type="button"
        onClick={copy}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-foreground"
        aria-label={`Copiar ${label}`}
      >
        {copied ? (
          <Check className="size-4 text-success-text" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </div>
  );
}
