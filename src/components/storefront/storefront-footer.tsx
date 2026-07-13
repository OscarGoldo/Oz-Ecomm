import { AtSign, MapPin, Phone } from "lucide-react";

import { LAYOUT_CHROME, type LayoutId } from "@/lib/theme";
import type { Store } from "@/types/database";

export function StorefrontFooter({
  store,
  layout = "classic",
}: {
  store: Store;
  layout?: LayoutId;
}) {
  const variant = (LAYOUT_CHROME[layout] ?? LAYOUT_CHROME.classic).footer;

  const contact = (
    <>
      {store.address && (
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 shrink-0" /> {store.address}
        </span>
      )}
      {store.phone && (
        <span className="inline-flex items-center gap-2">
          <Phone className="size-4 shrink-0" /> {store.phone}
        </span>
      )}
      {store.instagram && (
        <span className="inline-flex items-center gap-2">
          <AtSign className="size-4 shrink-0" /> {store.instagram}
        </span>
      )}
    </>
  );

  if (variant === "dark") {
    return (
      <footer className="mt-12 bg-neutral-950 text-white">
        <div className="container space-y-3 py-10">
          <p
            className="text-lg font-bold uppercase tracking-wide"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {store.name}
          </p>
          <div className="flex flex-col gap-2 text-sm text-white/60">{contact}</div>
          <p className="pt-4 text-xs text-white/40">
            Tienda creada con <span className="font-medium text-white/70">Tiendify</span>
          </p>
        </div>
      </footer>
    );
  }

  if (variant === "editorial") {
    return (
      <footer className="mt-16 border-t">
        <div className="container flex flex-col items-center gap-3 py-12 text-center">
          <p
            className="text-sm font-medium uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {store.name}
          </p>
          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground sm:flex-row sm:gap-5">
            {contact}
          </div>
          <p className="pt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Tienda creada con Tiendify
          </p>
        </div>
      </footer>
    );
  }

  // light (default)
  return (
    <footer className="mt-12 border-t bg-muted/30">
      <div className="container space-y-3 py-8">
        <p className="font-semibold">{store.name}</p>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">{contact}</div>
        <p className="pt-3 text-xs text-muted-foreground">
          Tienda creada con{" "}
          <span className="font-medium text-foreground">Tiendify</span>
        </p>
      </div>
    </footer>
  );
}
