import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";

/**
 * Aviso de estado del plan arriba del panel. Solo aparece cuando hay algo que
 * hacer: un pago en revisión, o un Pro por vencer. Con Pro vigente y sin nada
 * pendiente no se muestra nada — un banner permanente se vuelve invisible.
 */
export function PlanBanner({
  pro,
  daysLeft,
  pendingReview,
}: {
  pro: boolean;
  /** Días para el vencimiento; null si no vence o ya está en Gratis. */
  daysLeft: number | null;
  /** Hay un comprobante esperando aprobación. */
  pendingReview: boolean;
}) {
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

  if (pro && daysLeft !== null && daysLeft <= 7) {
    return (
      <Bar tone="warning">
        <Clock className="size-4 shrink-0" />
        <span>
          {daysLeft <= 0
            ? "Tu plan Pro vence hoy."
            : `Tu plan Pro vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}.`}{" "}
          <Link href="/panel/plan" className="font-medium underline">
            Renovar
          </Link>
        </span>
      </Bar>
    );
  }

  // Pro vencido hace poco: el plan ya cayó a Gratis (daysLeft es null), así que
  // este caso lo cubre el aviso genérico de abajo.
  if (!pro) {
    return (
      <Bar tone="info">
        <Sparkles className="size-4 shrink-0" />
        <span>
          Estás en el plan Gratis.{" "}
          <Link href="/panel/plan" className="font-medium underline">
            Activá Pro
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
  tone: "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-5 flex items-center gap-2 rounded-lg border p-3 text-sm print:hidden ${
        tone === "warning"
          ? "border-warning/40 bg-warning/10"
          : "border-primary/30 bg-primary/5"
      }`}
    >
      {children}
    </div>
  );
}
