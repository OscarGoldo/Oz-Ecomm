"use client";

import { ProductSearch, type SearchStore } from "@/components/storefront/product-search";
import { cn } from "@/lib/utils";

/** Search input tone, matching the header variant it sits on. */
export type SearchTone = "brand" | "light" | "dark";

const INPUT_TONES: Record<SearchTone, string> = {
  // On a colored brand bar → solid white pill (original look).
  brand:
    "bg-white text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/70",
  // On a light header → soft gray pill.
  light:
    "border-border bg-muted/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40",
  // On a dark header → translucent white pill.
  dark: "bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/40",
};

const ICON_TONES: Record<SearchTone, string> = {
  brand: "text-muted-foreground",
  light: "text-muted-foreground",
  dark: "text-white/50",
};

const CLEAR_TONES: Record<SearchTone, string> = {
  brand: "text-muted-foreground hover:text-foreground",
  light: "text-muted-foreground hover:text-foreground",
  dark: "text-white/50 hover:text-white",
};

export function HeaderSearch({
  store,
  tone = "brand",
}: {
  store: SearchStore;
  tone?: SearchTone;
}) {
  return (
    <ProductSearch
      store={store}
      // 16px en el teléfono: con menos, Safari agranda la página al tocar el cuadro.
      inputClassName={cn(
        "h-10 rounded-full border border-transparent pl-9 text-base md:text-sm",
        INPUT_TONES[tone],
      )}
      iconClassName={cn("left-3 size-4", ICON_TONES[tone])}
      clearClassName={CLEAR_TONES[tone]}
    />
  );
}
