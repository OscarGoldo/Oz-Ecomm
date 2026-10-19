"use client";

import { Check, Copy } from "lucide-react";

import { useCopyLink } from "@/components/admin/use-copy-link";

/**
 * La dirección de la tienda en la barra lateral, que se copia al tocarla. Es el
 * lugar fijo donde el dueño encuentra su link para pegarlo en Instagram o
 * WhatsApp: el aviso con "Copiar link" sale una sola vez.
 */
export function CopyStoreAddress({ url, address }: { url: string; address: string }) {
  const { copied, copy, linkRef } = useCopyLink<HTMLSpanElement>(url);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar el link de tu tienda: ${address}`}
      className="group mt-0.5 flex max-w-full items-center gap-1 rounded font-landing-mono text-[11px] text-niebla transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <span ref={linkRef} className="truncate">
        {copied ? "¡Copiado!" : address}
      </span>
      {copied ? (
        <Check className="size-3 shrink-0 text-sol" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
