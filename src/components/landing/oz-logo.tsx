import Image from "next/image";

import { cn } from "@/lib/utils";

/** OzShop symbol only (the bag mark). Official asset from /public. */
export function OzLogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/ozshop-symbol.svg"
      alt="OzShop"
      width={70}
      height={72}
      priority
      className={cn("h-8 w-auto", className)}
    />
  );
}

/** Full OzShop logo lockup (mark + wordmark). Official asset from /public. */
export function OzLogo({
  className,
  variant = "color",
}: {
  className?: string;
  variant?: "color" | "white";
}) {
  return (
    <Image
      src={variant === "white" ? "/ozshop-logo-white.svg" : "/ozshop-logo-color.svg"}
      alt="OzShop"
      width={290}
      height={72}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}
