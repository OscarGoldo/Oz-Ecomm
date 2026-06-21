import { Hammer } from "lucide-react";

/** Temporary placeholder for panel sections built in later phases. */
export function PhasePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
        <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Hammer className="size-6" />
        </span>
        <p className="font-medium">En construcción</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        <span className="mt-4 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {phase}
        </span>
      </div>
    </div>
  );
}
