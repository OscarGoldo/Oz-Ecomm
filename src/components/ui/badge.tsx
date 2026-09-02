import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Etiquetas de estado. Cada variante es un trío superficie / borde / texto en
 * vez del `bg-color/10 text-color` de antes: el color al 10% sobre blanco deja
 * el texto por debajo de 4.5:1 en verde y ámbar, y sin borde las píldoras
 * flotan sobre las filas de una tabla sin llegar a leerse como una unidad.
 *
 * Esquina en `rounded-md` y no píldora completa: el redondeo total lee más a
 * etiqueta de consumo que a estado de sistema.
 */
const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
    "text-2xs font-semibold leading-5 tracking-[0.005em] whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        default: "border-info-border bg-info-surface text-info-text",
        neutral: "border-border bg-muted text-muted-foreground",
        success: "border-success-border bg-success-surface text-success-text",
        warning: "border-warning-border bg-warning-surface text-warning-text",
        info: "border-info-border bg-info-surface text-info-text",
        danger:
          "border-destructive-border bg-destructive-surface text-destructive-text",
        outline: "border-border bg-transparent text-foreground",
        /** Sólido, para cuando la etiqueta es la información principal. */
        solid: "border-transparent bg-foreground text-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
