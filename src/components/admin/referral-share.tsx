"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { referralShareText } from "@/lib/referrals";

/**
 * El link de referido con sus dos acciones. Compartir por WhatsApp va primero
 * porque es por donde el comerciante habla con los otros comerciantes.
 */
export function ReferralShare({
  code,
  link,
}: {
  code: string;
  link: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("No se pudo copiar. Copiá el link a mano.");
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(referralShareText(code))}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{link}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Copiar link"
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <Share2 className="mr-2 size-4" /> Compartir por WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={copy}>
          {copied ? "¡Copiado!" : "Copiar link"}
        </Button>
      </div>
    </div>
  );
}
