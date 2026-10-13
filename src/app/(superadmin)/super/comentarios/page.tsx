import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Inbox, Mail, MessageCircle } from "lucide-react";

import { FeedbackReadButton } from "@/components/admin/feedback-read-button";
import { requireSuperAdmin } from "@/lib/auth";
import { feedbackKindLabel } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { whatsappUrl } from "@/lib/whatsapp";
import type { Feedback } from "@/types/database";

export const metadata = { title: "Comentarios" };

/**
 * Lo que escriben los comerciantes desde /panel/comentarios.
 *
 * Los sin leer van primero y resaltados: un comentario es alguien esperando
 * respuesta, igual que un comprobante en revisión.
 */
export default async function SuperFeedbackPage() {
  await requireSuperAdmin();
  const supabase = createClient();

  const [{ data: rows, error }, { data: stores }, { data: users }] =
    await Promise.all([
      supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("stores").select("id, name, whatsapp"),
      supabase.from("users").select("id, full_name, email"),
    ]);

  const list = (rows ?? []) as Feedback[];
  const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const unread = list.filter((f) => !f.read_at);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comentarios</h1>
          <p className="text-sm text-muted-foreground">
            Lo que te escriben los comerciantes desde su panel.
          </p>
        </div>
        {unread.length > 1 && <FeedbackReadButton />}
      </div>

      {error ? (
        // La tabla la crea la migración 0028. Sin ella la consulta falla, y eso
        // se dice en vez de mostrar una bandeja vacía que parece estar bien.
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          No se pudo leer la bandeja. Si todavía no corriste la migración{" "}
          <code className="font-mono text-xs">0028_feedback.sql</code> en
          Supabase, es eso: los comentarios te siguen llegando por correo, pero
          no se guardan acá hasta que la corras.
        </p>
      ) : list.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <Inbox className="mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Todavía nadie te escribió</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((f) => {
            const store = f.store_id ? storeById.get(f.store_id) : undefined;
            const author = f.user_id ? userById.get(f.user_id) : undefined;
            const wa = whatsappUrl(store?.whatsapp);
            return (
              <li
                key={f.id}
                className={`rounded-xl border bg-card p-4 ${
                  f.read_at ? "" : "border-warning/50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {store ? (
                    <Link
                      href={`/super/tiendas/${store.id}`}
                      className="font-semibold hover:underline"
                    >
                      {store.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">Tienda borrada</span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {feedbackKindLabel(f.kind)}
                  </span>
                  {!f.read_at && (
                    <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
                      Nuevo
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(f.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
                {author && (
                  <p className="text-xs text-muted-foreground">{author.full_name}</p>
                )}

                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {f.message}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  {author && (
                    <a
                      href={`mailto:${author.email}`}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
                    >
                      <Mail className="size-4" /> Responder por correo
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
                    >
                      <MessageCircle className="size-4" /> WhatsApp
                    </a>
                  )}
                  {!f.read_at && (
                    <span className="ml-auto">
                      <FeedbackReadButton id={f.id} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
