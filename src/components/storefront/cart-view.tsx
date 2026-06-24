"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageOff, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeCartItem, updateCartItem } from "@/lib/cart-actions";
import { getImageUrl } from "@/lib/storage";
import { formatBs, formatUSD } from "@/lib/format";
import type { EnrichedCart } from "@/lib/cart";

interface CartViewProps {
  storeId: string;
  storeSlug: string;
  cart: EnrichedCart;
}

export function CartView({ storeId, storeSlug, cart }: CartViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(productId: string, variantId: string | null, qty: number) {
    startTransition(async () => {
      await updateCartItem(storeId, productId, variantId, qty);
      router.refresh();
    });
  }

  function remove(productId: string, variantId: string | null) {
    startTransition(async () => {
      await removeCartItem(storeId, productId, variantId);
      toast.success("Producto quitado");
      router.refresh();
    });
  }

  if (cart.lines.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
        <ShoppingBag className="mb-3 size-9 text-muted-foreground" />
        <p className="font-medium">Tu carrito está vacío</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Agregá productos para empezar tu pedido.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/${storeSlug}`}>Ver productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {cart.lines.map((line) => {
          const cover = getImageUrl(line.product.images[0]);
          const capped = line.qty > line.available;
          const cap = line.product.track_stock ? line.product.stock : 99;
          return (
            <li
              key={`${line.product.id}:${line.variantId ?? ""}`}
              className="flex gap-3 rounded-xl border bg-card p-3"
            >
              <Link
                href={`/${storeSlug}/producto/${line.product.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt={line.product.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-muted-foreground">
                    <ImageOff className="size-5" />
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/${storeSlug}/producto/${line.product.slug}`}
                    className="line-clamp-2 text-sm font-medium"
                  >
                    {line.product.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(line.product.id, line.variantId)}
                    disabled={pending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Quitar"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {line.variantName && (
                  <p className="text-xs font-medium text-primary">
                    {line.variantName}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatUSD(line.unitPriceUsd)} c/u
                </p>
                {capped && (
                  <p className="text-xs text-warning-foreground">
                    Solo quedan {line.available}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-lg border">
                    <button
                      type="button"
                      onClick={() => change(line.product.id, line.variantId, line.qty - 1)}
                      disabled={pending}
                      className="grid size-8 place-items-center text-muted-foreground hover:text-foreground"
                      aria-label="Menos"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => change(line.product.id, line.variantId, Math.min(cap, line.qty + 1))}
                      disabled={pending || line.qty >= cap}
                      className="grid size-8 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Más"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="font-semibold">
                    {formatUSD(line.lineTotalUsd)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <div className="text-right">
            <p className="text-lg font-bold">{formatUSD(cart.subtotalUsd)}</p>
            {cart.showBs && cart.subtotalBs !== null && (
              <p className="text-sm text-muted-foreground">
                {formatBs(cart.subtotalBs)}
              </p>
            )}
          </div>
        </div>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href={`/${storeSlug}/checkout`}>Continuar compra</Link>
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href={`/${storeSlug}`}>Seguir comprando</Link>
        </Button>
      </div>
    </div>
  );
}
