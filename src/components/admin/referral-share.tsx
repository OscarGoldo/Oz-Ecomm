"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { referralShareText } from "@/lib/referrals";

function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Cópialo a mano.");
    }
  }
  return { copied, copy };
}

/**
 * El link de referido con sus acciones, sobre la tarjeta oscura de Referidos.
 * Compartir por WhatsApp va primero porque es por donde el comerciante habla
 * con los otros comerciantes.
 */
export function ReferralShare({ code, link }: { code: string; link: string }) {
  const { copied, copy } = useCopy();
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(referralShareText(code))}`;
  const shown = link.replace(/^https?:\/\//, "");
  const cut = shown.lastIndexOf("/") + 1;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex h-[52px] items-center gap-2.5 rounded-[14px] border border-white/10 bg-noche-suave pl-4 pr-2">
        {/* Si no cabe, se corta el dominio: el código es lo que importa. */}
        <span className="flex min-w-0 flex-1 font-landing-mono text-[15px] sm:text-base">
          <span className="truncate">{shown.slice(0, cut)}</span>
          <b className="shrink-0 text-sol">{shown.slice(cut)}</b>
        </span>
        <button
          type="button"
          onClick={() => copy(link)}
          className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-[10px] bg-white/10 px-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/15"
        >
          {copied ? <Check className="size-[15px] text-sol" /> : <Copy className="size-[15px]" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-sol px-[18px] text-[15px] font-bold text-noche transition-opacity hover:opacity-90"
        >
          <MessageCircle className="size-[17px]" /> Compartir por WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Copia el mensaje sugerido, para pegarlo en un grupo o en un DM de Instagram. */
export function CopyReferralMessage({ code }: { code: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button type="button" variant="outline" className="h-[42px]" onClick={() => copy(referralShareText(code))}>
      {copied ? <Check className="text-[#16A34A]" /> : <Copy />}
      {copied ? "Copiado" : "Copiar mensaje"}
    </Button>
  );
}
