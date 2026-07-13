import Image from "next/image";

import { cn } from "@/lib/utils";

/** Tiendify symbol only (the price-tag mark). Official asset from /public. */
export function TiendifyLogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/tiendify-symbol.svg"
      alt="Tiendify"
      width={70}
      height={70}
      priority
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** Full Tiendify logo lockup (mark + wordmark). Official asset from /public. */
export function TiendifyLogo({
  className,
  variant = "color",
}: {
  className?: string;
  variant?: "color" | "white";
}) {
  return (
    <Image
      src={variant === "white" ? "/tiendify-logo-white.svg" : "/tiendify-logo-color.svg"}
      alt="Tiendify"
      width={300}
      height={70}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}
