"use client";

import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface CartToastInput {
  name: string;
  image?: string | null;
  variant?: string | null;
  qty?: number;
  storeSlug: string;
}

/**
 * Small confirmation popup at the bottom of the screen showing the item just
 * added to the cart, with a "Ver carrito" shortcut.
 */
export function showCartToast({ name, image, variant, qty, storeSlug }: CartToastInput) {
  toast.custom(
    (t) => (
      <div className="flex w-[min(92vw,380px)] items-center gap-3 rounded-xl border bg-background p-3 shadow-lg">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={name} className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-muted-foreground">
              <ShoppingBag className="size-5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <Check className="size-3.5" /> Agregado al carrito
          </p>
          <p className="truncate text-sm font-medium">{name}</p>
          {(variant || (qty && qty > 1)) && (
            <p className="truncate text-xs text-muted-foreground">
              {variant}
              {variant && qty && qty > 1 ? " · " : ""}
              {qty && qty > 1 ? `x${qty}` : ""}
            </p>
          )}
        </div>
        <Link
          href={`/${storeSlug}/carrito`}
          onClick={() => toast.dismiss(t)}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Ver carrito
        </Link>
      </div>
    ),
    { position: "bottom-center", duration: 4000 },
  );
}
