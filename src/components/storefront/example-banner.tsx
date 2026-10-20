import { Sparkles } from "lucide-react";

import { publicSiteUrl } from "@/lib/site-url";

/**
 * La franja de las páginas ejemplo (las que arman los socios en
 * /super/ejemplos para mostrárselas a un negocio). Dice lo que es, para que
 * nadie que llegue por el link crea que es una tienda que vende de verdad, y
 * de paso lleva a Tiendify.
 */
export function ExampleBanner() {
  return (
    <div className="bg-neutral-950 px-4 py-2 text-center text-xs text-white/85">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <Sparkles className="size-3.5 shrink-0 text-amber-300" aria-hidden />
        <span>
          <strong className="font-semibold text-white">Página de ejemplo</strong> hecha con Tiendify.
        </span>
        <a
          href={publicSiteUrl()}
          className="font-semibold text-amber-300 underline-offset-2 hover:underline"
        >
          Crea la tuya
        </a>
      </span>
    </div>
  );
}
