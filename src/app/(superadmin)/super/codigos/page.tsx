import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Ticket } from "lucide-react";

import { PromoActiveSwitch, PromoLink } from "@/components/admin/promo-code-controls";
import { PromoCodeForm } from "@/components/admin/promo-code-form";
import { Badge } from "@/components/ui/badge";
import { requireSuperAdmin } from "@/lib/auth";
import { monthsLabel, promoState, type PromoState } from "@/lib/promo";
import { publicSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PromoCode, PromoRedemption } from "@/types/database";

export const metadata = { title: "Códigos" };

const STATE: Record<
  PromoState,
  { label: string; variant: "success" | "neutral" | "warning" }
> = {
  active: { label: "Activo", variant: "success" },
  exhausted: { label: "Agotado", variant: "neutral" },
  expired: { label: "Vencido", variant: "neutral" },
  off: { label: "Apagado", variant: "warning" },
};

const day = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: es });

/**
 * Códigos promocionales: meses de Pro gratis para quien crea su tienda con uno.
 *
 * Pensado para campañas ("las primeras 10 personas que se registren con el
 * código de tal"): se crea el código, se le pasa el link al influencer, y acá
 * se ve cuántos cupos quedan y qué tiendas entraron por él.
 */
export default async function SuperCodigosPage() {
  await requireSuperAdmin();

  const db = createAdminClient();
  const [{ data: codeRows, error }, { data: redemptionRows }] = await Promise.all([
    db.from("promo_codes").select("*").order("created_at", { ascending: false }),
    db
      .from("promo_redemptions")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);
  const codes = (codeRows ?? []) as PromoCode[];
  const redemptions = (redemptionRows ?? []) as PromoRedemption[];

  const storeIds = [...new Set(redemptions.map((r) => r.store_id))];
  const { data: stores } = storeIds.length
    ? await db.from("stores").select("id, name").in("id", storeIds)
    : { data: [] };
  const storeName = new Map((stores ?? []).map((s) => [s.id, s.name]));

  const byCode = new Map<string, PromoRedemption[]>();
  for (const r of redemptions) {
    const list = byCode.get(r.promo_code_id) ?? [];
    list.push(r);
    byCode.set(r.promo_code_id, list);
  }

  const signupUrl = `${publicSiteUrl()}/crear-tienda`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Códigos</h1>
        <p className="text-sm text-muted-foreground">
          Regala meses de Pro a quien cree su tienda con un código. Al terminar
          los meses, la tienda pasa a Gratis sola.
        </p>
      </div>

      {error ? (
        // Las tablas las crea la migración 0029. Sin ella no hay dónde guardar
        // un código, y eso se dice en vez de mostrar un formulario que falla.
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Todavía no se pueden crear códigos: falta correr la migración{" "}
          <code className="font-mono text-xs">0029_promo_codes.sql</code> en
          Supabase.
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Nuevo código</h2>
            <PromoCodeForm />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Tus códigos</h2>
            {codes.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
                <Ticket className="mb-3 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Todavía no creaste ninguno</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {codes.map((c) => {
                  const state = STATE[promoState(c)];
                  const used = byCode.get(c.id) ?? [];
                  return (
                    <li key={c.id} className="space-y-3 rounded-xl border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-base font-semibold">
                          {c.code}
                        </span>
                        <Badge variant={state.variant}>{state.label}</Badge>
                        <span className="ml-auto">
                          <PromoActiveSwitch id={c.id} active={c.active} />
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {monthsLabel(c.months)} de Pro gratis
                        </span>{" "}
                        ·{" "}
                        {c.max_uses === null
                          ? `${c.used_count} usados, sin límite`
                          : `${c.used_count} de ${c.max_uses} cupos usados`}{" "}
                        ·{" "}
                        {c.expires_at
                          ? `se acepta hasta el ${day(c.expires_at)}`
                          : "no vence"}
                        {c.note ? ` · ${c.note}` : ""}
                      </p>

                      {c.max_uses !== null && (
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={c.max_uses}
                          aria-valuenow={Math.min(c.used_count, c.max_uses)}
                          aria-label="Cupos usados"
                        >
                          <div
                            className="h-full rounded-full bg-foreground"
                            style={{
                              width: `${Math.min(100, (c.used_count / c.max_uses) * 100)}%`,
                            }}
                          />
                        </div>
                      )}

                      <PromoLink url={`${signupUrl}?codigo=${c.code}`} />

                      {used.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Lo usaron:{" "}
                          {used.map((r, i) => (
                            <span key={r.id}>
                              {i > 0 && ", "}
                              <Link
                                href={`/super/tiendas/${r.store_id}`}
                                className="font-medium text-foreground hover:underline"
                              >
                                {storeName.get(r.store_id) ?? "Tienda borrada"}
                              </Link>{" "}
                              ({day(r.created_at)})
                            </span>
                          ))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
