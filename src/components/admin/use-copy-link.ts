"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Copiar un link con red de contención, como en el checkout:
 * `navigator.clipboard` falla o no existe en varios navegadores embebidos. El
 * plan B selecciona el link que está a la vista (el elemento de `linkRef`) y
 * copia esa selección; si ni eso funciona, el link queda seleccionado para
 * copiarlo a mano. Sin elemento a la vista (un ítem de menú), el aviso de error
 * muestra el link.
 *
 * `copy()` devuelve si pudo, para quien quiera avisarlo a su manera (un menú se
 * cierra al elegir, así que no alcanza con cambiar el texto del botón).
 */
export function useCopyLink<T extends HTMLElement = HTMLParagraphElement>(url: string) {
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<T>(null);

  async function copy(): Promise<boolean> {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      const selection = window.getSelection();
      if (linkRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(linkRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
        try {
          ok = document.execCommand("copy");
        } catch {
          /* sigue al aviso de abajo */
        }
      }
    }
    if (!ok) {
      toast.error("Tu navegador no deja copiar", {
        description: linkRef.current
          ? "El link quedó seleccionado: cópialo a mano."
          : `Cópialo a mano: ${url}`,
      });
      return false;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    return true;
  }

  return { copied, copy, linkRef };
}
