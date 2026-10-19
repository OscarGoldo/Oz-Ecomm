import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { StoreActiveSwitch } from "@/components/admin/store-active-switch";
import { StorePlanControl } from "@/components/admin/store-plan-control";
import { requireSuperAdmin } from "@/lib/auth";
import { PAYMENT_METHOD_META } from "@/lib/constants";
import { formatUSD } from "@/lib/format";
import { SALES_STATUSES } from "@/lib/metrics";
import { isFounder, isPro, planState } from "@/lib/plans";
import { storeUrl as publicStoreUrl } from "@/lib/store-url";
import { storeClosedByOwner } from "@/lib/store-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { whatsappUrl } from "@/lib/whatsapp";
import type {
  AppUser,
  PaymentMethodType,
  Store,
  SubscriptionPayment,
  SubscriptionState,
} from "@/types/database";

export const metadata = { title: "Tienda" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "hace 3 días": no depende de la zona horaria del servidor. */
function ago(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
}

const SUBSCRIPTION_LABEL: Record<SubscriptionState, string> = {
  active: "Activa, se renueva sola",
  suspended: "Con un cobro fallido",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const PAYMENT_STATUS_LABEL: Record<SubscriptionPayment["status"], string> = {
  pending: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

/**
 * Todo lo que se sabe de una tienda y de quien la maneja, en una sola pantalla.
 *
 * Existe para poder escribirle a un comerciante sin ir a buscar su correo a
 * Supabase y su teléfono a la tienda pública: la lista de /super dice cómo le
 * va a la tienda, esto dice quién es la persona.
 */
export default async function SuperStorePage({
  params,
}: {
  params: { id: string };
}) {
  await requireSuperAdmin();
  const supabase = createClient();

  // Un id que no es UUID hace fallar la consulta y cae al mismo 404.
  const { data: storeRow } = await supabase
    .from("stores")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!storeRow) notFound();
  const store = storeRow as Store;

  const [
    { data: team },
    { data: payments },
    { data: sales },
    { count: orderCount },
    { data: lastOrder },
    { count: productCount },
  ] = await Promise.all([
    supabase.from("users").select("*").eq("store_id", store.id).order("created_at"),
    supabase
      .from("subscription_payments")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select("total")
      .eq("store_id", store.id)
      .in("status", SALES_STATUSES),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
    supabase
      .from("orders")
      .select("created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
  ]);

  const people = (team ?? []) as AppUser[];
  const owner = people.find((u) => u.role === "store_owner") ?? people[0];
  const others = people.filter((u) => u.id !== owner?.id);
  const planPayments = (payments ?? []) as SubscriptionPayment[];
  const gmv = (sales ?? []).reduce((s, o) => s + Number(o.total), 0);

  // El último ingreso vive en Supabase Auth, no en nuestra tabla de usuarios,
  // y solo se puede leer con la clave de servicio.
  let lastSignIn: string | null = null;
  if (owner) {
    const { data } = await createAdminClient().auth.admin.getUserById(owner.id);
    lastSignIn = data.user?.last_sign_in_at ?? null;
  }

  const pro = isPro(store);
  const founder = isFounder(store);
  const state = planState(store);
  const comp = store.plan_source === "comp";
  const planLabel =
    state === "paused"
      ? "En pausa (no renovó)"
      : state === "grace"
        ? "Pro vencido, en gracia"
        : state === "free"
          ? "Gratis"
          : comp
            ? founder
              ? "Pro de cortesía"
              : "Prueba de Pro"
            : "Pro, pagando";
  const closed = storeClosedByOwner(store);
  const wa = whatsappUrl(store.whatsapp);
  const storeUrl = publicStoreUrl(store);
  const subscription = store.stripe_subscription_status
    ? { via: "Tarjeta (Stripe)", status: store.stripe_subscription_status }
    : store.paypal_subscription_status
      ? { via: "PayPal", status: store.paypal_subscription_status }
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/super/tiendas"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tiendas
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {store.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {planLabel}{" "}
              · {store.active ? "en línea" : closed ? "cerrada por su dueño" : "pausada"}
            </p>
          </div>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
          >
            Ver tienda <ExternalLink className="size-4" />
          </a>
          <StorePlanControl storeId={store.id} note={store.plan_note} founder={founder} />
          <StoreActiveSwitch storeId={store.id} active={store.active} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Dueño">
          {owner ? (
            <>
              <Row label="Nombre">{owner.full_name}</Row>
              <Row label="Correo">
                <a href={`mailto:${owner.email}`} className="hover:underline">
                  {owner.email}
                </a>
              </Row>
              <Row label="WhatsApp">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {store.whatsapp}
                  </a>
                ) : (
                  <Empty>No lo dejó</Empty>
                )}
              </Row>
              <Row label="Último ingreso">
                {lastSignIn ? (
                  <>
                    {ago(lastSignIn)}{" "}
                    <span className="text-muted-foreground">
                      · {fmtDate(lastSignIn)}
                    </span>
                  </>
                ) : (
                  <Empty>Nunca entró</Empty>
                )}
              </Row>
              <Row label="Se registró">{fmtDate(owner.created_at)}</Row>
              {!owner.active && <Row label="Cuenta">Desactivada</Row>}
            </>
          ) : (
            <Row label="Usuario">
              <Empty>Esta tienda no tiene un usuario asignado</Empty>
            </Row>
          )}
          {others.length > 0 && (
            <Row label="Otros usuarios">
              {others.map((u) => `${u.full_name} (${u.email})`).join(", ")}
            </Row>
          )}
        </Section>

        <Section title="Contacto de la tienda">
          <Row label="Link">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all hover:underline"
            >
              {storeUrl.replace(/^https?:\/\//, "")}
            </a>
          </Row>
          <Row label="Teléfono">{store.phone || <Empty />}</Row>
          <Row label="Correo">
            {store.email ? (
              <a href={`mailto:${store.email}`} className="hover:underline">
                {store.email}
              </a>
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Instagram">{store.instagram || <Empty />}</Row>
          <Row label="Dirección">{store.address || <Empty />}</Row>
          <Row label="Creada">{fmtDate(store.created_at)}</Row>
        </Section>

        <Section title="Plan">
          <Row label="Plan actual">
            {planLabel}
          </Row>
          <Row label="Precio">
            {founder
              ? "Fundadora: Pro a US$5 o US$50 al año; sin Pro queda en Gratis"
              : "Nueva: Pro a precio de lista; sin Pro se pausa tras 7 días de gracia"}
          </Row>
          <Row label="Vence">
            {store.plan === "pro" && store.plan_expires_at ? (
              fmtDate(store.plan_expires_at)
            ) : pro ? (
              "Sin vencimiento"
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Suscripción">
            {subscription ? (
              `${subscription.via}: ${SUBSCRIPTION_LABEL[subscription.status]}`
            ) : (
              <Empty>No tiene cobro automático</Empty>
            )}
          </Row>
          {store.stripe_customer_id && (
            <Row label="En Stripe">
              <a
                href={`https://dashboard.stripe.com/customers/${store.stripe_customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Ver cliente <ExternalLink className="size-3.5" />
              </a>
            </Row>
          )}
          <Row label="Nota interna">{store.plan_note || <Empty />}</Row>
        </Section>

        <Section title="Actividad">
          <Row label="Productos">{productCount ?? 0}</Row>
          <Row label="Pedidos">{orderCount ?? 0}</Row>
          <Row label="Ventas">
            {(sales ?? []).length}{" "}
            <span className="text-muted-foreground">· {formatUSD(gmv)}</span>
          </Row>
          <Row label="Último pedido">
            {lastOrder ? ago(lastOrder.created_at) : <Empty>Todavía ninguno</Empty>}
          </Row>
        </Section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pagos del plan</h2>
        {planPayments.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Esta tienda nunca pagó un plan.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {planPayments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{formatUSD(Number(p.amount))}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.period_months === 1 ? "1 mes" : `${p.period_months} meses`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {fmtDate(p.created_at)} ·{" "}
                    {PAYMENT_METHOD_META[p.method as PaymentMethodType]?.label ??
                      p.method}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    p.status === "approved"
                      ? "bg-success/15 text-success"
                      : p.status === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/15 text-warning-foreground"
                  }`}
                >
                  {PAYMENT_STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Un dato que no está. Dice por qué cuando se sabe, y si no, una raya. */
function Empty({ children = "—" }: { children?: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
