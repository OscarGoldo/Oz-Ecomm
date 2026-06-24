"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/lib/cart-actions";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  storeId,
  productId,
  className,
  hasVariants,
  href,
}: {
  storeId: string;
  productId: string;
  className?: string;
  /** When true, the product needs option selection → link to its detail page. */
  hasVariants?: boolean;
  href?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const baseClass = cn(
    "relative z-20 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70",
    className,
  );

  if (hasVariants && href) {
    return (
      <Link href={href} className={baseClass}>
        <SlidersHorizontal className="size-4" />
        Elegir opciones
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await addToCart(storeId, productId, 1);
          if (!res.ok) {
            toast.error("No se pudo agregar");
            return;
          }
          toast.success("Agregado al carrito");
          router.refresh();
        })
      }
      className={baseClass}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Plus className="size-4" />
      )}
      Agregar
    </button>
  );
}
