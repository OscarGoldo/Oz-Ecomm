"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/cart-actions";

interface ProductActionsProps {
  storeId: string;
  storeSlug: string;
  productId: string;
  available: boolean;
  maxQty: number | null;
}

export function ProductActions({
  storeId,
  storeSlug,
  productId,
  available,
  maxQty,
}: ProductActionsProps) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();

  const cap = maxQty && maxQty > 0 ? maxQty : 99;
  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(cap, q + 1));

  function handleAdd() {
    startTransition(async () => {
      const res = await addToCart(storeId, productId, qty);
      if (!res.ok) {
        toast.error("No se pudo agregar");
        return;
      }
      toast.success("Agregado al carrito", {
        action: {
          label: "Ver carrito",
          onClick: () => router.push(`/${storeSlug}/carrito`),
        },
      });
      router.refresh();
    });
  }

  if (!available) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 text-center text-sm font-medium text-muted-foreground">
        Producto agotado
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Cantidad</span>
        <div className="flex items-center rounded-lg border">
          <button
            type="button"
            onClick={dec}
            className="grid size-10 place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Menos"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={inc}
            className="grid size-10 place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Más"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <Button onClick={handleAdd} disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
        Agregar al carrito
      </Button>
    </div>
  );
}
