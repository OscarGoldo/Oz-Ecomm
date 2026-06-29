import { cn } from "@/lib/utils";

/**
 * OzShop brand mark: a cloud with a concentric "O" ring and a small loop on
 * top. Pure SVG, uses currentColor so it inherits the brand blue.
 */
export function OzLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Cloud */}
      <path
        d="M20 42 C9 42 4 28 14 25 C10 13 28 8 32 19 C40 9 56 16 52 28 C60 30 57 42 46 42 Z"
        strokeWidth={4.5}
      />
      {/* O ring */}
      <circle cx="31.5" cy="31" r="7.5" strokeWidth={4.5} />
      {/* Top loop */}
      <circle cx="31.5" cy="16.5" r="5" strokeWidth={4} />
    </svg>
  );
}

/** Full logo lockup: mark + "OzShop" wordmark (Oz heavier, Shop lighter). */
export function OzLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <OzLogoMark className="size-8" />
      <span className="text-lg tracking-tight">
        <span className="font-extrabold">Oz</span>
        <span className="font-medium">Shop</span>
      </span>
    </span>
  );
}
