import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Este componente lo comparten el panel y la tienda pública, así que solo
 * puede usar tokens sobrescribibles (`primary`, `secondary`, `border`…). En el
 * panel `--primary` es tinta y en la tienda es el color que eligió el dueño:
 * el mismo botón se ve profesional en los dos lados sin ramas por superficie.
 */
const buttonVariants = cva(
  [
    "group relative inline-flex select-none items-center justify-center gap-2",
    "whitespace-nowrap rounded-lg text-sm font-medium tracking-[-0.006em]",
    // La transición cubre color, sombra y transform: sin `transform` el estado
    // :active no se siente, y un botón que no se hunde al tocarlo es de las
    // cosas que hacen que una interfaz se sienta de cartón.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45",
    // Foco por ring propio en lugar del outline global: acá sí queremos el
    // halo pegado a la forma del botón.
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /**
         * Acción principal. La línea interior blanca al 14% arriba es el
         * truco viejo de los botones sólidos: simula que la luz le pega por
         * encima y le da volumen sin recurrir a un degradado.
         */
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.14),0_1px_2px_0_hsl(24_13%_8%/0.10)]",
          "hover:bg-primary/90",
          "hover:shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.14),0_2px_6px_-1px_hsl(24_13%_8%/0.16)]",
          "active:shadow-[inset_0_1px_2px_0_hsl(24_13%_8%/0.18)]",
        ],
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.14),0_1px_2px_0_hsl(24_13%_8%/0.10)]",
          "hover:bg-destructive/90",
          "active:shadow-[inset_0_1px_2px_0_hsl(24_13%_8%/0.18)]",
        ],
        /**
         * Acción secundaria de verdad: borde y sombra mínima, como un botón
         * físico claro. El `hover` mueve el fondo, no el borde, para que no
         * parpadee el contorno.
         */
        outline: [
          "border border-input bg-background text-foreground shadow-xs",
          "hover:bg-muted hover:text-foreground",
          "active:bg-muted active:shadow-none",
        ],
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/70 active:bg-secondary",
        ],
        ghost: "text-foreground hover:bg-muted active:bg-muted",
        /**
         * Enlace de texto. Subrayado con `decoration` fina y descendido: el
         * subrayado por defecto corta las bajantes de las letras.
         */
        link: [
          "h-auto p-0 text-primary underline-offset-4 active:translate-y-0",
          "hover:underline hover:decoration-[1.5px]",
        ],
      },
      // Alturas pensadas para el pulgar: 44px es el mínimo táctil recomendado y
      // acá casi todo se toca desde un celular. `sm` queda en 40 para densidad
      // en tablas del panel, nunca para acciones principales en móvil.
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-10 rounded-md px-3",
        lg: "h-12 rounded-xl px-6 text-[0.9375rem]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
