import { AtSign, MapPin, Phone } from "lucide-react";

import type { Store } from "@/types/database";

export function StorefrontFooter({ store }: { store: Store }) {
  return (
    <footer className="mt-12 border-t bg-muted/30">
      <div className="container space-y-3 py-8">
        <p className="font-semibold">{store.name}</p>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
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
        </div>
        <p className="pt-3 text-xs text-muted-foreground">
          Tienda creada con{" "}
          <span className="font-medium text-foreground">OzShop</span>
        </p>
      </div>
    </footer>
  );
}
