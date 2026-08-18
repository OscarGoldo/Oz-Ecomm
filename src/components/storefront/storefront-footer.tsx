import Link from "next/link";
import { AtSign, MapPin, MessageCircle, Phone } from "lucide-react";

import { isPro } from "@/lib/plans";
import { whatsappUrl } from "@/lib/whatsapp";
import { LAYOUT_CHROME, type LayoutId } from "@/lib/theme";
import type { Store } from "@/types/database";

export function StorefrontFooter({
  store,
  layout = "classic",
}: {
  store: Store;
  layout?: LayoutId;
}) {
  const variant = (LAYOUT_CHROME[layout] ?? LAYOUT_CHROME.classic).footer;

  /**
   * Badge del plan Gratis. Es un link real con `?ref=<slug>`: cada tienda
   * gratis es un canal de adquisición, y el `ref` deja ver de dónde vino cada
   * registro. En Pro desaparece (es parte de lo que se paga).
   */
  const badge = isPro(store) ? null : (
    <Link href={`/?ref=${store.slug}`} className="hover:underline">
      Hecho con <span className="font-medium">Tiendify</span>
    </Link>
  );

  // Enlaces de verdad, no texto plano. El teléfono y el Instagram estaban
  // escritos como cadenas sueltas: en un celular, tocarlos no hacía nada.
  const waUrl = whatsappUrl(store.whatsapp);
  const igUser = store.instagram?.replace(/^@/, "").trim();

  const contact = (
    <>
      {store.address && (
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 shrink-0" /> {store.address}
        </span>
      )}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 hover:underline"
        >
          <MessageCircle className="size-4 shrink-0" /> Escríbenos por WhatsApp
        </a>
      )}
      {store.phone && (
        <a
          href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex min-h-11 items-center gap-2 hover:underline"
        >
          <Phone className="size-4 shrink-0" /> {store.phone}
        </a>
      )}
      {igUser && (
        <a
          href={`https://instagram.com/${igUser}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 hover:underline"
        >
          <AtSign className="size-4 shrink-0" /> {igUser}
        </a>
      )}
    </>
  );

  if (variant === "dark") {
    return (
      <footer className="mt-12 bg-neutral-950 text-white">
        <div className="container space-y-3 py-10">
          <p
            className="text-lg font-bold uppercase tracking-wide"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {store.name}
          </p>
          <div className="flex flex-col gap-2 text-sm text-white/60">{contact}</div>
          {badge && <p className="pt-4 text-xs text-white/40">{badge}</p>}
        </div>
      </footer>
    );
  }

  if (variant === "editorial") {
    return (
      <footer className="mt-16 border-t">
        <div className="container flex flex-col items-center gap-3 py-12 text-center">
          <p
            className="text-sm font-medium uppercase tracking-[0.3em]"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            {store.name}
          </p>
          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground sm:flex-row sm:gap-5">
            {contact}
          </div>
          {badge && (
            <p className="pt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
              {badge}
            </p>
          )}
        </div>
      </footer>
    );
  }

  // light (default)
  return (
    <footer className="mt-12 border-t bg-muted/30">
      <div className="container space-y-3 py-8">
        <p className="font-semibold">{store.name}</p>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">{contact}</div>
        {badge && <p className="pt-3 text-xs text-muted-foreground">{badge}</p>}
      </div>
    </footer>
  );
}
