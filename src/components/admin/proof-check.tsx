"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Loader2,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { readOrderProof } from "@/app/(admin)/panel/pedidos/actions";
import { formatBs, formatUSD } from "@/lib/format";
import type { ProofCheckView, ProofFlag, ProofReading } from "@/lib/proof-rules";
import { cn } from "@/lib/utils";
import type { ProofVerdict } from "@/types/database";

/** Si otra pestaña está leyendo la misma captura, se espera su resultado. */
const POLL_MS = 4000;
const MAX_POLLS = 15;

const VERDICT: Record<
  ProofVerdict,
  { title: string; note: string; icon: typeof ShieldCheck; box: string; ink: string }
> = {
  ok: {
    title: "Cuadra con el pedido",
    note: "Monto, fecha y destino coinciden con lo que se ve.",
    icon: ShieldCheck,
    box: "border-success-border",
    ink: "text-success-text",
  },
  review: {
    title: "Revisa esto antes de confirmar",
    note: "Puede ser un error del cliente o de la lectura.",
    icon: AlertTriangle,
    box: "border-warning-border",
    ink: "text-warning-text",
  },
  suspicious: {
    title: "No cuadra con el pedido",
    note: "No lo confirmes hasta ver el pago en tu banco.",
    icon: ShieldAlert,
    box: "border-destructive/40",
    ink: "text-destructive",
  },
};

const DOT: Record<ProofFlag["severity"], string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-ink-300",
};

function amountLabel(r: ProofReading): string | null {
  if (r.amount === null) return null;
  if (r.currency === "VES") return formatBs(r.amount);
  if (r.currency === "USD") return formatUSD(r.amount);
  if (r.currency === "USDT" || r.currency === "USDC") return `${r.amount.toFixed(2)} ${r.currency}`;
  return String(r.amount);
}

function dateLabel(r: ProofReading): string | null {
  if (!r.date) return null;
  const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return r.time ? `${day} · ${r.time}` : day;
}

/**
 * La lectura del comprobante con IA, dentro de "Verifica el pago".
 *
 * Si todavía no se leyó, la pide al montarse: tarda unos segundos y el
 * comerciante igual tiene la captura al lado. El veredicto va arriba porque es
 * lo que decide si hace falta mirar con lupa; los datos leídos van abajo,
 * con la referencia lista para copiar y buscar en el banco.
 */
export function ProofCheck({
  orderId,
  initial,
  autoRead,
}: {
  orderId: string;
  initial: ProofCheckView | null;
  /** Leer ahora si falta (solo mientras el pedido está por confirmar). */
  autoRead: boolean;
}) {
  const [check, setCheck] = useState(initial);
  const [busy, setBusy] = useState(autoRead && (!initial || initial.status === "reading"));
  const polls = useRef(0);

  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const res = await readOrderProof(orderId).catch(() => null);
      if (cancelled) return;
      if (res?.status === "reading" && polls.current < MAX_POLLS) {
        polls.current += 1;
        setCheck(res);
        timer = setTimeout(run, POLL_MS);
        return;
      }
      setCheck(res);
      setBusy(false);
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [busy, orderId]);

  if (busy) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border bg-card p-3.5 text-sm text-ink-600">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span>Leyendo el comprobante con IA. Tarda unos segundos.</span>
      </div>
    );
  }

  if (!check) return null;

  if (check.status !== "done" || !check.verdict || !check.reading) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed bg-card p-3.5 text-sm text-ink-600">
        <span>No pudimos leer la captura. Revísala a mano.</span>
        {check.canRetry && (
          <button
            type="button"
            onClick={() => {
              polls.current = 0;
              setBusy(true);
            }}
            className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:underline"
          >
            <RotateCw className="size-3.5" /> Volver a leer
          </button>
        )}
      </div>
    );
  }

  const v = VERDICT[check.verdict];
  const Icon = v.icon;
  const r = check.reading;
  const amount = amountLabel(r);
  const date = dateLabel(r);
  const banks = [r.originBank, r.destinationBank].filter(Boolean).join(" → ");
  const paidTo = [r.destination, r.recipientName].filter(Boolean).join(" · ");

  return (
    <div className={cn("rounded-xl border bg-card p-3.5", v.box)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 size-5 shrink-0", v.ink)} />
        <div className="min-w-0">
          <p className={cn("font-semibold", v.ink)}>{v.title}</p>
          <p className="text-xs text-ink-600">{v.note}</p>
        </div>
      </div>

      {check.flags.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {check.flags.map((f) => (
            <li key={f.code} className="flex gap-2">
              <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[f.severity])} />
              <span className={f.severity === "info" ? "text-ink-600" : undefined}>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      {r.isReceipt && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-dashed pt-3 text-sm">
          {amount && (
            <>
              <dt className="text-ink-600">Monto</dt>
              <dd className="font-landing-mono font-semibold tabular-nums">{amount}</dd>
            </>
          )}
          {r.reference && (
            <>
              <dt className="text-ink-600">Referencia</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate font-landing-mono font-semibold">{r.reference}</span>
                <button
                  type="button"
                  aria-label="Copiar referencia"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(r.reference ?? "")
                      .then(() => toast.success("Referencia copiada"))
                      .catch(() => undefined);
                  }}
                  className="rounded p-0.5 text-ink-500 hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </dd>
            </>
          )}
          {date && (
            <>
              <dt className="text-ink-600">Fecha</dt>
              <dd className="font-landing-mono">{date}</dd>
            </>
          )}
          {banks && (
            <>
              <dt className="text-ink-600">Banco</dt>
              <dd className="min-w-0 truncate">{banks}</dd>
            </>
          )}
          {paidTo && (
            <>
              <dt className="text-ink-600">Pagado a</dt>
              <dd className="min-w-0 truncate">{paidTo}</dd>
            </>
          )}
        </dl>
      )}

      <p className="mt-3 text-xs text-ink-500">
        Lo leyó la IA en la captura: no confirma que la plata llegó. Búscalo en tu banco
        antes de confirmar.
      </p>
    </div>
  );
}
