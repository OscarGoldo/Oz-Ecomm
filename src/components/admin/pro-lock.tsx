import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** Píldora "Pro" para marcar una función bloqueada. */
export function ProChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      <Sparkles className="size-2.5" /> Pro
    </span>
  );
}

/**
 * Cartel de upsell. Se usa arriba de una sección bloqueada, o como pantalla
 * completa cuando la página entera es Pro.
 */
export function ProUpsell({
  title,
  text,
  cta = "Ver plan Pro",
  className,
}: {
  title: string;
  text: string;
  cta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/5 p-5 text-center",
        className,
      )}
    >
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      <Link
        href="/panel/plan"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Sparkles className="size-4" /> {cta}
      </Link>
    </div>
  );
}

/**
 * Envuelve un preview con datos de ejemplo: lo desenfoca y le superpone el
 * upsell. Mostrar la función borrosa convierte mucho mejor que esconderla —
 * el comerciante ve exactamente lo que se está perdiendo.
 */
export function ProLockedPreview({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none select-none blur-[6px] saturate-50"
      >
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-start justify-center bg-background/40 pt-10 sm:pt-16">
        <ProUpsell title={title} text={text} className="mx-4 bg-background shadow-lg" />
      </div>
    </div>
  );
}
