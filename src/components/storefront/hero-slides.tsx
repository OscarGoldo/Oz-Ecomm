"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Cross-fading background slides for a hero. Renders absolutely-positioned
 * image layers; the caller overlays its own gradient + content on top.
 * Falls back to a single static image when there's 0–1 slides.
 */
export function HeroSlides({
  slides,
  fallback,
  alt,
  intervalMs = 5000,
  imageClassName = "object-cover",
}: {
  slides: string[];
  fallback?: string | null;
  alt: string;
  intervalMs?: number;
  imageClassName?: string;
}) {
  const images = slides.length > 0 ? slides : fallback ? [fallback] : [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % images.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((src, i) => (
        <Image
          key={`${src}-${i}`}
          src={src}
          alt={i === 0 ? alt : ""}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`${imageClassName} transition-opacity duration-1000 ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Imagen ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
