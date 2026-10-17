"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lo que conecta la vista previa (adentro del iframe) con el editor (afuera).
 *
 * El editor manda: "refresh" (ya guardó el borrador: volver a dibujar),
 * "select" (resaltar una sección y llevarla a la vista) y "style" (colores y
 * fuentes al instante, sin esperar al servidor).
 *
 * La vista previa manda: "ready" y "select" cuando el comerciante hace clic en
 * una sección. Los clics no navegan ni agregan al carrito: acá se edita, no se
 * compra.
 */
/**
 * Lleva la sección a la vista. Si todavía no existe (se acaba de agregar y el
 * borrador se está guardando), espera a que aparezca, hasta 6 segundos.
 */
function scrollToSection(id: string) {
  const find = () => document.querySelector(`[data-section-id="${CSS.escape(id)}"]`);
  const go = (el: Element) => el.scrollIntoView({ behavior: "smooth", block: "start" });
  const el = find();
  if (el) return go(el);
  const observer = new MutationObserver(() => {
    const found = find();
    if (found) {
      observer.disconnect();
      go(found);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 6000);
}

export function PreviewBridge() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  // Variables de estilo que puso el editor, para sacar las que sobran al cambiar de estilo.
  const styleKeys = useRef<string[]>([]);

  useEffect(() => {
    const post = (msg: Record<string, unknown>) =>
      window.parent?.postMessage({ source: "tiendify-preview", ...msg }, window.location.origin);

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as { source?: string; type?: string; id?: string; vars?: Record<string, string> };
      if (msg?.source !== "tiendify-editor") return;
      if (msg.type === "refresh") router.refresh();
      if (msg.type === "select") {
        setSelected(msg.id ?? null);
        if (msg.id) scrollToSection(msg.id);
      }
      if (msg.type === "style" && msg.vars) {
        const root = document.querySelector<HTMLElement>(".storefront");
        if (!root) return;
        for (const k of styleKeys.current) if (!(k in msg.vars)) root.style.removeProperty(k);
        for (const [k, v] of Object.entries(msg.vars)) root.style.setProperty(k, v);
        styleKeys.current = Object.keys(msg.vars).filter((k) => k.startsWith("--"));
      }
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest("a, button, form, input, select, textarea, video");
      const section = target.closest<HTMLElement>("[data-section-id]");
      if (interactive || section) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (section?.dataset.sectionId) {
        setSelected(section.dataset.sectionId);
        post({ type: "select", id: section.dataset.sectionId });
      }
    }

    const onSubmit = (e: Event) => e.preventDefault();

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    post({ type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [router]);

  // Con CSS y no tocando el DOM: así el resaltado sobrevive a cada refresh.
  const sel = selected ? `[data-section-id="${selected.replace(/"/g, "")}"]` : null;
  return (
    <style>{`
      [data-section-id] { position: relative; cursor: pointer; scroll-margin-top: 72px; }
      [data-section-id]:hover { outline: 2px dashed hsl(var(--primary) / 0.6); outline-offset: -2px; }
      ${sel ? `${sel} { outline: 2px solid hsl(var(--primary)); outline-offset: -2px; }` : ""}
      ${sel ? `${sel}::before { content: attr(data-section-label); position: absolute; top: 6px; left: 6px; z-index: 20; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font: 600 11px/1 system-ui, sans-serif; padding: 4px 8px; border-radius: 6px; }` : ""}
    `}</style>
  );
}
