"use client";

import { useEffect } from "react";

/**
 * Las entradas al bajar de la portada. Un solo IntersectionObserver para todos
 * los elementos con `data-reveal` (ver `reveal()` en landing-ui).
 *
 * Solo esconde lo que está fuera de la pantalla al cargar: lo que ya se ve
 * nunca parpadea, y sin JS o con "reducir movimiento" la página queda completa
 * desde el primer cuadro. Cada elemento entra una sola vez: animar de nuevo
 * en cada pasada es una interfaz peleándose con quien la lee.
 *
 *   ""        → sin reglas (estado de partida)
 *   "pending" → escondido, esperando entrar en vista
 *   "in"      → animando la entrada
 *   "done"    → sin reglas otra vez: sus transiciones propias (hover) mandan
 */
export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          el.dataset.reveal = "in";
          const delay = parseInt(getComputedStyle(el).getPropertyValue("--reveal-delay")) || 0;
          timers.push(window.setTimeout(() => (el.dataset.reveal = "done"), delay + 1400));
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const fold = window.innerHeight * 0.92;
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (el.dataset.reveal || el.getBoundingClientRect().top < fold) return;
      el.dataset.reveal = "pending";
      io.observe(el);
    });

    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
