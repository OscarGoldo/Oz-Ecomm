"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, CreditCard, Loader2, Send } from "lucide-react";
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
   * no está acá (el trimestre) se cobra una sola vez y no se renueva.
   */
  planIds: Partial<Record<number, string>> | null;
  /** ¿Está Stripe configurado en la plataforma? */
  stripeEnabled: boolean;
  /**
   * Períodos que tienen precio recurrente en Stripe. Los que no están se
   * cobran una sola vez — y hay que decírselo, porque la diferencia entre "se
   * renueva solo" y "se vence" es la que le hace perder el Pro sin darse cuenta.
   */
  stripeRecurringPeriods: number[];
}) {
  const router = useRouter();
  const [months, setMonths] = useState<number>(12);
  // PayPal primero cuando está disponible: se activa solo, sin esperar
  // revisión. El comprobante queda para quien paga en Bs.
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
  /** ¿El período elegido se renueva solo en Stripe? */
  const stripeRecurring = stripeRecurringPeriods.includes(months);
  /**
   * Plan recurrente para el período elegido, si existe. El trimestre no tiene,
   * así que se cobra una sola vez — y hay que decírselo al comerciante, porque
   * la diferencia entre "se renueva solo" y "se vence" es justo la que le hace
   * perder el Pro sin darse cuenta.
   */
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

  // JSX en variables, no en componentes anidados: un componente definido aquí
  // adentro cambia de identidad en cada render y React lo remontaría, con lo
  // que el input de referencia perdería el foco en cada tecla.
  const manualPayment = (
    <>
      <div className="space-y-2">
        <Label className="text-xs">2. ¿Cómo vas a pagar?</Label>
        <div className="flex flex-wrap gap-1.5">
          {payments.map((p) => (
            <button
              key={p.method}
              type="button"
              onClick={() => setMethod(p.method as ManualMethod)}
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
        <Label className="text-xs">3. Sube el comprobante</Label>
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
            <CreditCard /> Pagar {formatUSD(amount)} con tarjeta
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Pago seguro con Stripe. No necesitas cuenta.{" "}
        {stripeRecurring
          ? `Se renueva ${months >= 12 ? "cada año" : "cada mes"} y puedes cancelar cuando quieras.`
          : "Es un pago único: no se renueva solo, te avisamos antes de que venza."}
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
        Puedes pagar con tarjeta de débito o crédito sin tener cuenta de PayPal.{" "}
        {recurringPlanId
          ? `Se renueva ${months >= 12 ? "cada año" : "cada mes"} y puedes cancelar cuando quieras.`
          : "Es un pago único: no se renueva solo, te avisamos antes de que venza."}
      </p>
    </div>
  );

  const vias: { id: PayVia; title: string; sub: string }[] = [
    ...(stripeEnabled
      ? [
          {
            id: "stripe" as const,
            title: "Tarjeta",
            sub: "Se activa al instante",
          },
        ]
      : []),
    ...(paypalClientId
      ? [{ id: "paypal" as const, title: "PayPal", sub: "Se activa al instante" }]
      : []),
    ...(payments.length > 0
      ? [
          {
            id: "manual" as const,
            title: "Pago Móvil, Zelle…",
            sub: "Con comprobante",
          },
        ]
      : []),
  ];

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Activar Pro</CardTitle>
        <p className="text-xs text-muted-foreground">
          {stripeEnabled || paypalClientId
            ? "Paga con tarjeta y se activa solo, o paga en bolívares y sube el comprobante."
            : "Haz el pago, sube el comprobante y lo confirmamos. No necesitas tarjeta de crédito."}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1. Período */}
        <div className="space-y-2">
          <Label className="text-xs">1. ¿Por cuánto tiempo?</Label>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_PERIODS.map((m) => {
              const total = priceFor(m, prices);
              const perMonth = total / m;
              // El anual se cuenta en "meses gratis" porque es como se entiende
              // de un vistazo; el trimestre, en porcentaje. Y si el precio no
              // trae descuento, no se anuncia ninguno.
              const free = freeMonths(m, prices);
              const pct = savingPct(m, prices);
              const badge =
                m >= 12 && free > 0
                  ? `${free} ${free === 1 ? "mes" : "meses"} gratis`
                  : pct > 0
                    ? `ahorras ${pct}%`
                    : null;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={cn(
                    "rounded-2xl border p-2.5 text-left transition-colors",
                    months === m
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-primary/40",
                  )}
                >
                  <p className="text-xs font-semibold">
                    {m === 1 ? "1 mes" : `${m} meses`}
                  </p>
                  <p className="text-base font-bold tracking-tight">
                    {formatUSD(total)}
                  </p>
                  {m > 1 && (
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {formatUSD(perMonth)}/mes
                    </p>
                  )}
                  {badge && (
                    <p className="text-[11px] font-medium leading-tight text-success">
                      {badge}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Monto a pagar */}
        <div className="rounded-2xl border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Total a pagar</p>
          <p className="text-2xl font-bold tracking-tight">{formatUSD(amount)}</p>
          {amountBs !== null && (
            <p className="text-sm text-muted-foreground">
              {formatBs(amountBs)}{" "}
              <span className="text-xs">(tasa BCV de hoy)</span>
            </p>
          )}
        </div>

        {/* 3. Cómo paga */}
        {nothingConfigured ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Todavía no hay métodos de pago configurados. Escribinos para activar
            tu plan.
          </p>
        ) : (
          <>
            {vias.length > 1 && (
              <div
                className={cn(
                  "grid gap-2",
                  vias.length >= 3 ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                {vias.map((v) => (
                  <ViaTab
                    key={v.id}
                    active={via === v.id}
                    onClick={() => setVia(v.id)}
                    title={v.title}
                    sub={v.sub}
                  />
                ))}
              </div>
            )}
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
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3 text-left transition-colors",
        active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
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
