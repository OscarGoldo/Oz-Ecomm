"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Galería del producto.
 *
 * En móvil se desliza: cambiar de foto exigía apuntarle a una miniatura de
 * 64 px, y todo el mundo intenta arrastrar sobre la imagen grande primero.
 * Tocar abre a pantalla completa con pinch-zoom — en ropa y accesorios, ver la
 * textura de cerca es parte de decidir la compra, y el Instagram del que viene
 * el cliente sí deja hacer zoom.
 */
export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Bloquea el scroll del fondo y cierra con Escape mientras está ampliada.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  if (images.length === 0) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-xl border bg-muted text-muted-foreground">
        <ImageOff className="size-10" />
      </div>
    );
  }

  /** El índice se deduce del scroll: así el punto activo sigue al dedo. */
  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active && i >= 0 && i < images.length) setActive(i);
  }

  function goTo(i: number) {
    setActive(i);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-xl border bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setZoomed(true)}
              aria-label={`Ampliar ${alt}`}
              className="relative aspect-square w-full shrink-0 snap-center"
            >
              <Image
                src={img}
                alt={i === 0 ? alt : `${alt} — foto ${i + 1}`}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-3"
              />
            </button>
          ))}
        </div>

        {/* Puntos de posición: en móvil son la única pista de que hay más fotos. */}
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden">
            {images.map((img, i) => (
              <span
                key={img}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === active ? "bg-foreground" : "bg-foreground/25",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="hidden gap-2 overflow-x-auto pb-1 sm:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors",
                i === active ? "border-primary" : "border-muted",
              )}
            >
              <Image
                src={img}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      {zoomed && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="size-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto [touch-action:pinch-zoom]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[active]!}
              alt={alt}
              className="mx-auto max-h-full w-auto object-contain p-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
