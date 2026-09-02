import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // h-11: el panel se usa mayormente desde el teléfono y 44px es el
          // mínimo táctil. El foco mueve el borde y suma un halo suave en vez
          // del ring desplazado de fábrica, que sobre campos pegados en una
          // grilla se solapa con el vecino.
          "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-base",
          "shadow-[inset_0_1px_1px_0_hsl(24_13%_8%/0.04)]",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/80",
          "outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]",
          "md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
