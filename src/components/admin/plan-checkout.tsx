"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { requestProUpgrade } from "@/app/(admin)/panel/plan/actions";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import { PLAN_PERIODS, priceFor } from "@/lib/plans";
import type { SubscriptionMethod } from "@/types/database";
import { cn } from "@/lib/utils";

export interface PlatformPaymentView {
  method: SubscriptionMethod;
  label: string;
  fields: { label: string; value: string }[];
}

export function PlanCheckout({
  storeId,
  prices,
  payments,
  bcvRate,
}: {
  storeId: string;
  prices: { monthly: number; yearly: number };
  payments: PlatformPaymentView[];
  /** Tasa BCV para mostrar el monto en Bs. null = solo USD. */
  bcvRate: number | null;
}) {
  const router = useRouter();
  const [months, setMonths] = useState<number>(12);
  const [method, setMethod] = useState<SubscriptionMethod | null>(
    payments[0]?.method ?? null,
  );
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const amount = priceFor(months, prices);
  const amountBs = usdToBs(amount, bcvRate);
  const selected = payments.find((p) => p.method === method);

  async function submit() {
    if (!method) return toast.error("Elegí cómo pagaste");
    if (!proof) return toast.error("Subí la foto del comprobante");

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activar Pro</CardTitle>
        <p className="text-xs text-muted-foreground">
          Hacé el pago, subí el comprobante y lo confirmamos. No necesitás
          tarjeta de crédito.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1. Período */}
        <div className="space-y-2">
          <Label className="text-xs">1. ¿Por cuánto tiempo?</Label>
          <div className="grid grid-cols-2 gap-3">
            {PLAN_PERIODS.map((m) => {
              const total = priceFor(m, prices);
              const perMonth = total / m;
              const saving = m >= 12 ? Math.round((1 - perMonth / prices.monthly) * 12) : 0;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    months === m
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-semibold">
                    {m === 1 ? "1 mes" : `${m} meses`}
                  </p>
                  <p className="text-lg font-bold tracking-tight">
                    {formatUSD(total)}
                  </p>
                  {m > 1 && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatUSD(perMonth)}/mes
                      {saving > 0 && ` · ${saving} meses gratis`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Monto a pagar */}
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">Total a pagar</p>
          <p className="text-2xl font-bold tracking-tight">{formatUSD(amount)}</p>
          {amountBs !== null && (
            <p className="text-sm text-muted-foreground">
              {formatBs(amountBs)} <span className="text-xs">(tasa BCV de hoy)</span>
            </p>
          )}
        </div>

        {/* 3. Método + datos */}
        {payments.length === 0 ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            Todavía no hay métodos de pago configurados. Escribinos para activar
            tu plan.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs">2. ¿Cómo vas a pagar?</Label>
              <div className="flex flex-wrap gap-1.5">
                {payments.map((p) => (
                  <button
                    key={p.method}
                    type="button"
                    onClick={() => setMethod(p.method)}
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
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Pagá a estos datos:
                </p>
                {selected.fields.map((f) => (
                  <CopyRow key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            )}

            {/* 4. Comprobante */}
            <div className="space-y-2">
              <Label className="text-xs">3. Subí el comprobante</Label>
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
                Número de referencia <span className="text-muted-foreground">(opcional)</span>
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
        )}
      </CardContent>
    </Card>
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
