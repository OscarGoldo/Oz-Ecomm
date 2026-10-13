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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  storeId,
  prices,
  payments,
  bcvRate,
  paypalClientId,
  planIds,
  stripeEnabled,
  stripeRecurringPeriods,
}: {
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
      <div className="space-y-2">
        <Label className="text-xs">{stepPeriod + 1}. ¿Por dónde vas a pagar?</Label>
        <div className="flex flex-wrap gap-1.5">
          {payments.map((p) => (
            <button
              key={p.method}
              type="button"
              onClick={() => setMethod(p.method as ManualMethod)}
              aria-pressed={method === p.method}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                method === p.method
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-primary/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-2 rounded-2xl border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Paga a estos datos:
          </p>
          {selected.fields.map((f) => (
            <CopyRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">{stepPeriod + 2}. Sube el comprobante</Label>
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
        <Label htmlFor="ref" className="text-xs">
          Número de referencia{" "}
          <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Últimos dígitos de la referencia"
          maxLength={120}
        />
      </div>

      <Button onClick={submit} disabled={sending} className="w-full">
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
      <Button className="w-full" onClick={goToStripe} disabled={redirecting}>
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
      <p className="text-center text-xs text-muted-foreground">
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
      <p className="text-center text-xs text-muted-foreground">
        Puedes pagar con tarjeta de débito o crédito sin tener cuenta de PayPal.
      </p>
    </div>
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Activar Pro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {nothingConfigured ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Todavía no hay métodos de pago configurados. Escribinos para activar
            tu plan.
          </p>
        ) : (
          <>
            {/* 1. Cómo paga */}
            {choosesVia && (
              <div className="space-y-2">
                <Label className="text-xs">1. ¿Cómo quieres pagar?</Label>
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
            <div className="space-y-2">
              <Label className="text-xs">
                {stepPeriod}.{" "}
                {viaRenews(via) ? "¿Cada cuánto se cobra?" : "¿Por cuánto tiempo?"}
              </Label>
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
                        "rounded-2xl border p-3 text-left transition-colors",
                        months === m
                          ? "border-primary ring-1 ring-primary"
                          : "hover:border-primary/40",
                      )}
                    >
                      <p className="text-xs font-semibold">
                        {auto ? (year ? "Anual" : "Mensual") : year ? "1 año" : "1 mes"}
                      </p>
                      <p className="text-lg font-bold tracking-tight">
                        {formatUSD(total)}
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {auto ? (year ? "por año" : "por mes") : "un solo pago"}
                      </p>
                      {badge && (
                        <p className="mt-0.5 text-[11px] font-medium leading-tight text-success">
                          {badge}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Así funciona */}
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Así funciona
              </p>
              <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Hoy pagas</dt>
                <dd>
                  <span className="text-lg font-bold leading-none tracking-tight">
                    {formatUSD(amount)}
                  </span>
                  {via === "manual" && amountBs !== null && (
                    <span className="block text-xs text-muted-foreground">
                      {formatBs(amountBs)} (tasa BCV de hoy)
                    </span>
                  )}
                </dd>

                <dt className="text-muted-foreground">Se activa</dt>
                <dd>
                  {via === "manual"
                    ? "Cuando confirmemos tu comprobante."
                    : "Al instante."}
                </dd>

                <dt className="text-muted-foreground">Después</dt>
                <dd>
                  {renews
                    ? `Se cobra sola cada ${every}, sin que hagas nada.`
                    : `No se cobra nada solo. Tu Pro dura ${lasts} y los últimos 7 días te lo recordamos aquí en el panel.`}
                </dd>

                <dt className="text-muted-foreground">Para dejarlo</dt>
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
      </CardContent>
    </Card>
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
        "rounded-2xl border p-3 text-left transition-colors",
        active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
      )}
    >
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-1.5 text-sm font-semibold leading-tight">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
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
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Copiar ${label}`}
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );
}
