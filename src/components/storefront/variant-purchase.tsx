"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, ShoppingCart, X, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/storefront/price";
import { addToCart } from "@/lib/cart-actions";
import { showCartToast } from "@/components/storefront/cart-toast";
import { cn } from "@/lib/utils";
import type { VariantOption } from "@/types/database";

export interface VariantClient {
  id: string;
  option_values: string[];
  price: number | null;
  stock: number;
  active: boolean;
}

interface VariantPurchaseProps {
  storeId: string;
  storeSlug: string;
  productId: string;
  productName: string;
  image?: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  exchangeRate: number | null;
  showBs: boolean;
  options: VariantOption[];
  variants: VariantClient[];
}

export function VariantPurchase({
  storeId,
  storeSlug,
  productId,
  productName,
  image,
  basePrice,
  compareAtPrice,
  exchangeRate,
  showBs,
  options,
  variants,
}: VariantPurchaseProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<(string | null)[]>(
    () => options.map(() => null),
  );
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [buying, setBuying] = useState(false);

  const priceOf = (v: VariantClient) => (v.price != null ? v.price : basePrice);

  const selectedVariant =
    selected.every((s) => s !== null)
      ? variants.find(
          (v) =>
            v.active && options.every((_, i) => v.option_values[i] === selected[i]),
        ) ?? null
      : null;

  const available = Boolean(
    selectedVariant && selectedVariant.active && selectedVariant.stock > 0,
  );

  // Price to show: selected variant, or "desde" the cheapest active variant.
  const activePrices = variants.filter((v) => v.active).map(priceOf);
  const minPrice = activePrices.length ? Math.min(...activePrices) : basePrice;
  const maxPrice = activePrices.length ? Math.max(...activePrices) : basePrice;
  const displayPrice = selectedVariant ? priceOf(selectedVariant) : minPrice;
  const showFrom = !selectedVariant && minPrice !== maxPrice;

  /** Is a value still reachable given the other axes already chosen? */
  function valueAvailable(axisIdx: number, value: string): boolean {
    return variants.some(
      (v) =>
        v.active &&
        v.stock > 0 &&
        v.option_values[axisIdx] === value &&
        options.every(
          (_, j) => j === axisIdx || selected[j] == null || v.option_values[j] === selected[j],
        ),
    );
  }

  function pick(axisIdx: number, value: string) {
    setSelected((prev) => {
      const next = [...prev];
      next[axisIdx] = next[axisIdx] === value ? null : value;
      return next;
    });
    setQty(1);
  }

  const cap = selectedVariant && selectedVariant.stock > 0 ? selectedVariant.stock : 1;
  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(cap, q + 1));

  function ensureSelected(): boolean {
    if (selectedVariant) return true;
    const missing = options
      .filter((_, i) => selected[i] == null)
      .map((o) => o.name)
      .join(", ");
    toast.error(`Elige: ${missing || "una opción"}`);
    return false;
  }

  function handleAdd() {
    if (!ensureSelected()) return;
    startTransition(async () => {
      const res = await addToCart(storeId, productId, qty, selectedVariant!.id);
      if (!res.ok) {
        toast.error("No se pudo agregar");
        return;
      }
      showCartToast({
        name: productName,
        image,
        variant: selectedVariant!.option_values.join(" / "),
        qty,
        storeSlug,
      });
      router.refresh();
    });
  }

  function handleBuyNow() {
    if (!ensureSelected()) return;
    setBuying(true);
    startTransition(async () => {
      const res = await addToCart(storeId, productId, qty, selectedVariant!.id);
      if (!res.ok) {
        setBuying(false);
        toast.error("No se pudo continuar");
        return;
      }
      router.push(`/${storeSlug}/checkout`);
    });
  }

  const busy = pending || buying;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        {showFrom && (
          <span className="text-xs font-medium text-muted-foreground">Desde</span>
        )}
        <Price
          amountUsd={displayPrice}
          compareAtUsd={selectedVariant ? null : compareAtPrice}
          exchangeRate={exchangeRate}
          showBs={showBs}
          size="lg"
        />
      </div>

      {/* Axis selectors */}
      <div className="space-y-3">
        {options.map((axis, i) => (
          <div key={axis.name} className="space-y-1.5">
            <p className="text-sm font-medium">
              {axis.name}
              {selected[i] && (
                <span className="ml-1 text-muted-foreground">· {selected[i]}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {axis.values.map((value) => {
                const isSel = selected[i] === value;
                const reachable = valueAvailable(i, value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pick(i, value)}
                    className={cn(
                      "min-w-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      isSel
                        ? "border-primary bg-primary/5 text-foreground"
                        : reachable
                          ? "hover:border-primary/40"
                          : "text-muted-foreground line-through opacity-60",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Availability */}
      {selectedVariant ? (
        available ? (
          <Badge variant="success" className="gap-1">
            <Check className="size-3.5" /> Disponible
            {selectedVariant.stock <= 5 ? ` · quedan ${selectedVariant.stock}` : ""}
          </Badge>
        ) : (
          <Badge variant="danger" className="gap-1">
            <X className="size-3.5" /> Agotado
          </Badge>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Elige {options.map((o) => o.name.toLowerCase()).join(" y ")} para continuar.
        </p>
      )}

      {/* Quantity + buy */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Cantidad</span>
          <div className="flex items-center rounded-lg border">
            <button
              type="button"
              onClick={dec}
              disabled={!available}
              className="grid size-10 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Menos"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center text-sm font-medium">{qty}</span>
            <button
              type="button"
              onClick={inc}
              disabled={!available || qty >= cap}
              className="grid size-10 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Más"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <Button
          onClick={handleBuyNow}
          disabled={busy || (selectedVariant != null && !available)}
          className="w-full"
          size="lg"
        >
          {buying ? <Loader2 className="animate-spin" /> : <Zap />}
          Comprar ahora
        </Button>
        <Button
          onClick={handleAdd}
          disabled={busy || (selectedVariant != null && !available)}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {pending && !buying ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
          Agregar al carrito
        </Button>
      </div>
    </div>
  );
}
