import Link from "next/link";
import { Clock, PauseCircle, Sparkles } from "lucide-react";

import type { PlanState } from "@/lib/plans";

/**
 * Aviso de estado del plan arriba del panel. Solo aparece cuando hay algo que
 * hacer: un pago en revisión, un Pro por vencer, una tienda nueva en gracia o
 * en pausa. Con Pro vigente y sin nada pendiente no se muestra nada — un
 * banner permanente se vuelve invisible.
 */
export function PlanBanner({
  state,
  daysLeft,
  pauseIn,
  trial,
  pendingReview,
}: {
  state: PlanState;
  /** Días para el vencimiento; null si no vence o ya está en Gratis. */
  daysLeft: number | null;
  /** Días que le quedan a una tienda en gracia antes de pausarse. */
  pauseIn: number | null;
  /** El Pro de una tienda nueva que todavía no pagó: es su prueba. */
  trial: boolean;
  /** Hay un comprobante esperando aprobación. */
  pendingReview: boolean;
}) {
  const pro = state === "pro";
  if (pendingReview) {
    return (
      <Bar tone="info">
        <Clock className="size-4 shrink-0" />
        <span>
          Tu comprobante está en revisión. Te activamos el plan Pro apenas lo
          confirmemos.
        </span>
      </Bar>
    );
  }

  if (state === "paused") {
    return (
      <Bar tone="danger">
        <PauseCircle className="size-4 shrink-0" />
        <span>
          Tu tienda está en pausa: tus clientes no pueden comprar.{" "}
          <Link href="/panel/plan" className="font-medium underline">
            Activa tu plan
          </Link>{" "}
          y vuelve al instante, tal como estaba.
        </span>
      </Bar>
    );
  }

  if (state === "grace") {
    return (
      <Bar tone="danger">
        <Clock className="size-4 shrink-0" />
        <span>
          Tu plan venció.{" "}
          {pauseIn !== null && pauseIn <= 1
            ? "Mañana tu tienda se pausa"
            : `En ${pauseIn ?? 0} días tu tienda se pausa`}{" "}
          y tus clientes no podrán comprar.{" "}
          <Link href="/panel/plan" className="font-medium underline">
            Renovar
          </Link>
        </span>
      </Bar>
    );
  }

  if (pro && daysLeft !== null && daysLeft <= 7) {
    const what = trial ? "Tu prueba gratis termina" : "Tu plan Pro vence";
    return (
      <Bar tone="warning">
        <Clock className="size-4 shrink-0" />
        <span>
          {daysLeft <= 0
            ? `${what} hoy.`
            : `${what} en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}.`}{" "}
          <Link href="/panel/plan" className="font-medium underline">
            {trial ? "Activar Pro" : "Renovar"}
          </Link>
        </span>
      </Bar>
    );
  }

  // Una fundadora con Pro vencido cae a Gratis (daysLeft es null), así que
  // este caso lo cubre el aviso genérico de abajo.
  if (state === "free") {
    return (
      <Bar tone="info">
        <Sparkles className="size-4 shrink-0" />
        <span>
          Estás en el plan Gratis.{" "}
          <Link href="/panel/plan" className="font-medium underline">
            Activa Pro
          </Link>{" "}
          para tener todas las plantillas, analítica, cupones y productos
          ilimitados.
        </span>
      </Bar>
    );
  }

  return null;
}

function Bar({
  tone,
  children,
}: {
  tone: "info" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-5 flex items-center gap-2 rounded-lg border p-3 text-sm print:hidden ${
        tone === "danger"
          ? "border-destructive-border bg-destructive-surface text-destructive-text"
          : tone === "warning"
            ? "border-warning/40 bg-warning/10"
            : "border-primary/30 bg-primary/5"
      }`}
    >
      {children}
    </div>
  );
}
