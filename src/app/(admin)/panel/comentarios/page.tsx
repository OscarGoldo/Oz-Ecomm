import { MessageCircle } from "lucide-react";

import { FeedbackForm } from "@/components/admin/feedback-form";
import { buttonVariants } from "@/components/ui/button";
import { requireStoreUser } from "@/lib/auth";
import { supportWhatsapp } from "@/lib/support";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata = { title: "Comentarios" };

/**
 * Por dónde un comerciante le dice a Tiendify que algo no le funciona, no le
 * gusta o le falta. El formulario queda guardado y llega por correo; el
 * WhatsApp es para quien prefiere conversar.
 */
export default async function ComentariosPage() {
  const { user, store } = await requireStoreUser();

  // El mensaje arranca con quién es: del otro lado solo se ve un número.
  const wa = whatsappUrl(
    supportWhatsapp(),
    `Hola, soy ${user.full_name}, de la tienda ${store.name} en Tiendify. `,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comentarios</h1>
        <p className="text-sm text-muted-foreground">
          ¿Algo no te funciona, no te gusta o te falta? Dinos: lo lee quien hace
          Tiendify.
        </p>
      </div>

      <FeedbackForm />

      {wa && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-semibold">¿Prefieres conversar?</p>
            <p className="text-sm text-muted-foreground">
              Escríbenos directo por WhatsApp.
            </p>
          </div>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <MessageCircle /> Abrir WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
