"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Copiar un link con red de contención, como en el checkout:
 * `navigator.clipboard` falla o no existe en varios navegadores embebidos. El
 * plan B selecciona el link que está a la vista (el elemento de `linkRef`) y
 * copia esa selección; si ni eso funciona, el link queda seleccionado para
 * copiarlo a mano.
 */
export function useCopyLink(url: string) {
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLParagraphElement>(null);

  async function copy() {
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
        description: "El link quedó seleccionado: cópialo a mano.",
      });
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return { copied, copy, linkRef };
}
