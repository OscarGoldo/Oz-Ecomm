import Link from "next/link";
import { Check, ChevronRight, Rocket } from "lucide-react";

export interface ChecklistStep {
  label: string;
  done: boolean;
  href: string;
}

export function WelcomeChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Rocket className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Configurá tu tienda</h2>
          <p className="text-xs text-muted-foreground">
            {doneCount} de {steps.length} listos
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-1">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                  step.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-muted-foreground/30 text-transparent"
                }`}
              >
                <Check className="size-3.5" />
              </span>
              <span
                className={`flex-1 text-sm ${
                  step.done ? "text-muted-foreground line-through" : "font-medium"
                }`}
              >
                {step.label}
              </span>
              {!step.done && <ChevronRight className="size-4 text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
