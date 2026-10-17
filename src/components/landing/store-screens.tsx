import { Check, ChevronLeft, Copy, Lock, MessageCircle, ShoppingBag } from "lucide-react";

import { ProductPhoto, bs, bsShort, usd } from "@/components/landing/landing-ui";
import { cn } from "@/lib/utils";

/**
 * Pantallazos de una tienda Tiendify dentro de un teléfono: la vitrina, el
 * producto, el carrito, el pago y el pedido recibido. Los usan el hero (solo
 * el pago) y el recorrido de tiendas de ejemplo (los cinco).
 *
 * Siguen los pasos y los textos del checkout real ("Continuar compra",
 * "Confirmar pedido", "Avisar a la tienda por WhatsApp", "Por confirmar"). Si
 * esos textos cambian en la tienda, se cambian acá.
 *
 * Cada tienda trae sus colores como variables: --p primario, --pi tinta sobre
 * primario, --a acento, --ai tinta sobre acento, --s fondo, --k texto, su
 * tipografía en --sf y la redondez de sus botones en --r. Son colores fijos:
 * es la tienda del comerciante, no la landing.
 */

export interface StoreTheme {
  p: string;
  pi: string;
  a: string;
  ai: string;
  s: string;
  k: string;
  sf: string;
  r: string;
}

export type PayMethod = "pm" | "zelle" | "binance";

export interface ExampleProduct {
  name: string;
  usd: number;
  photo: string;
}

export interface ExampleStore {
  name: string;
  rubro: string;
  slug: string;
  theme: StoreTheme;
  kick: string;
  title: string;
  cats: string[];
  products: ExampleProduct[];
  option: { label: string; values: string[]; selected: number };
  cart: { product: number; option: string; qty: number }[];
  method: PayMethod;
  order: number;
}

export const themeVars = (t: StoreTheme) =>
  ({
    "--p": t.p,
    "--pi": t.pi,
    "--a": t.a,
    "--ai": t.ai,
    "--s": t.s,
    "--k": t.k,
    "--sf": t.sf,
    "--r": t.r,
  }) as React.CSSProperties;

export const cartTotal = (store: ExampleStore) =>
  store.cart.reduce((sum, c) => sum + store.products[c.product]!.usd * c.qty, 0);

const METHODS: { id: PayMethod | "cash"; label: string }[] = [
  { id: "pm", label: "Pago Móvil" },
  { id: "zelle", label: "Zelle" },
  { id: "binance", label: "Binance" },
  { id: "cash", label: "Efectivo" },
];
const METHOD_LABEL: Record<PayMethod, string> = { pm: "Pago Móvil", zelle: "Zelle", binance: "Binance" };

/* --- Piezas ---------------------------------------------------------------- */

export function PhoneFrame({
  theme,
  children,
  className,
}: {
  theme: StoreTheme;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative w-[216px] shrink-0 rounded-[34px] bg-noche p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_30px_50px_-24px_hsl(var(--noche)/0.55)]",
        className,
      )}
      style={themeVars(theme)}
    >
      <div className="relative flex h-[420px] flex-col overflow-hidden rounded-[27px] bg-[color:var(--s)] font-landing-body text-[10px] leading-[1.35] text-[color:var(--k)]">
        {children}
      </div>
    </div>
  );
}

function Url({ slug }: { slug: React.ReactNode }) {
  return (
    <div className="mx-[9px] mt-[9px] flex h-6 shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg bg-black/5 px-2 font-landing-mono text-[8.5px] font-medium text-black/55">
      <Lock className="size-[9px] shrink-0" strokeWidth={2.2} />
      usatiendify.com/
      <b className="truncate font-semibold text-[color:var(--k)]">{slug}</b>
    </div>
  );
}

function Brand({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-w-0 truncate font-[family-name:var(--sf)] text-sm font-bold leading-tight text-[color:var(--p)]">
      {children}
    </span>
  );
}

function Top({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-2.5">
      {children}
    </div>
  );
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-[9px] overflow-hidden px-3 pb-3", className)}>
      {children}
    </div>
  );
}

function Bag() {
  return <ShoppingBag className="size-[17px] shrink-0" strokeWidth={1.8} />;
}

function Button({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mt-auto flex h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--r)] bg-[color:var(--p)] px-2.5 text-[10px] font-bold text-[color:var(--pi)] [&_svg]:size-3 [&_svg]:shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --- Pantallas ------------------------------------------------------------- */

/** 1. La vitrina: portada, categorías y productos en $ y Bs. */
export function ShowcaseScreen({ store, rate }: { store: ExampleStore; rate: number | null }) {
  return (
    <>
      <Url slug={store.slug} />
      <Top>
        <Brand>{store.name}</Brand>
        <Bag />
      </Top>
      <Body>
        <div className="grid shrink-0 gap-1 rounded-xl bg-[color:var(--p)] p-3 text-[color:var(--pi)]">
          <span className="font-landing-mono text-[7.5px] font-semibold uppercase tracking-[0.1em] opacity-75">
            {store.kick}
          </span>
          <span className="font-[family-name:var(--sf)] text-[15px] font-bold leading-[1.05]">
            {store.title}
          </span>
          <span className="mt-0.5 justify-self-start rounded-[var(--r)] bg-[color:var(--a)] px-[9px] py-[5px] text-[8.5px] font-bold text-[color:var(--ai)]">
            Ver todo
          </span>
        </div>
        <div className="flex shrink-0 gap-[5px] overflow-hidden">
          {store.cats.map((c, i) => (
            <span
              key={c}
              className={cn(
                "whitespace-nowrap rounded-[var(--r)] px-2 py-1 text-[8.5px] font-semibold",
                i === 0 ? "bg-[color:var(--p)] text-[color:var(--pi)]" : "bg-black/5",
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {store.products.map((p) => (
            <div key={p.name} className="overflow-hidden rounded-[10px] border border-black/[0.07] bg-white text-noche">
              <ProductPhoto src={p.photo} sizes="100px" className="aspect-[1/0.86]" />
              <div className="grid gap-px px-[7px] pb-[7px] pt-[5px]">
                <span className="truncate text-[8.5px] font-semibold opacity-80">{p.name}</span>
                <span className="font-[family-name:var(--sf)] text-[11px] font-bold leading-tight">
                  ${p.usd}
                </span>
                {rate && (
                  <span className="font-landing-mono text-[7.5px] leading-tight opacity-60">
                    {bsShort(p.usd, rate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Body>
    </>
  );
}

/** 2. El producto: foto, precio, la variante elegida y "Agregar al carrito". */
export function ProductScreen({ store, rate }: { store: ExampleStore; rate: number | null }) {
  const p = store.products[0]!;
  return (
    <>
      <Url slug={store.slug} />
      <Top>
        <ChevronLeft className="size-[17px] shrink-0" strokeWidth={1.8} />
        <Brand>{store.name}</Brand>
        <Bag />
      </Top>
      <Body>
        <div className="relative shrink-0">
          <ProductPhoto src={p.photo} sizes="200px" className="h-[166px] rounded-[14px]" />
          <span className="absolute bottom-[9px] left-1/2 flex -translate-x-1/2 gap-1">
            <i className="size-[5px] rounded-full bg-black/60" />
            <i className="size-[5px] rounded-full bg-black/20" />
            <i className="size-[5px] rounded-full bg-black/20" />
          </span>
        </div>
        <p className="font-[family-name:var(--sf)] text-[15px] font-bold leading-tight">{p.name}</p>
        <div className="flex flex-wrap items-baseline gap-[7px]">
          <b className="font-[family-name:var(--sf)] text-[17px] font-extrabold leading-none">${p.usd}</b>
          {rate && <span className="font-landing-mono text-[9px] opacity-65">{bs(p.usd, rate)}</span>}
        </div>
        <p className="text-[8px] font-bold uppercase tracking-[0.07em] opacity-60">{store.option.label}</p>
        <div className="flex flex-wrap gap-[5px]">
          {store.option.values.map((v, i) => (
            <span
              key={v}
              className={cn(
                "min-w-[30px] rounded-[var(--r)] border px-2 py-1.5 text-center text-[9px] font-bold",
                i === store.option.selected
                  ? "border-[color:var(--p)] bg-[color:var(--p)] text-[color:var(--pi)]"
                  : "border-black/15",
              )}
            >
              {v}
            </span>
          ))}
        </div>
        <Button>Agregar al carrito</Button>
      </Body>
    </>
  );
}

/** 3. El carrito, con cada línea y el subtotal en las dos monedas. */
export function CartScreen({ store, rate }: { store: ExampleStore; rate: number | null }) {
  const total = cartTotal(store);
  return (
    <>
      <Url slug={store.slug} />
      <Top>
        <ChevronLeft className="size-[17px] shrink-0" strokeWidth={1.8} />
        <Brand>{store.name}</Brand>
        <Bag />
      </Top>
      <Body>
        <p className="font-[family-name:var(--sf)] text-base font-bold leading-tight">Tu carrito</p>
        <div className="grid">
          {store.cart.map((c) => {
            const p = store.products[c.product]!;
            const line = p.usd * c.qty;
            return (
              <div
                key={p.name}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 border-b border-black/[0.08] py-2"
              >
                <ProductPhoto src={p.photo} sizes="44px" className="size-11 rounded-[9px]" />
                <div className="min-w-0">
                  <p className="truncate text-[9.5px] font-bold">{p.name}</p>
                  <p className="text-[8.5px] opacity-60">{c.option}</p>
                  <span className="mt-[3px] inline-flex items-center gap-[7px] rounded-full border border-black/15 px-[7px] py-px text-[9px] font-bold">
                    − <span>{c.qty}</span> +
                  </span>
                </div>
                <p className="text-right font-landing-mono text-[10px] font-semibold leading-tight">
                  {usd(line)}
                  {rate && <small className="block text-[7.5px] font-medium opacity-60">{bs(line, rate)}</small>}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-start justify-between pt-0.5">
          <span className="text-[10px] opacity-70">Subtotal</span>
          <b className="text-right font-landing-mono text-[13px] font-bold leading-tight">
            {usd(total)}
            {rate && <small className="block text-[8.5px] font-medium opacity-60">{bs(total, rate)}</small>}
          </b>
        </div>
        <Button>Continuar compra</Button>
        <p className="shrink-0 text-center text-[9px] font-semibold opacity-70">Seguir comprando</p>
      </Body>
    </>
  );
}

/**
 * 4. El pago: los métodos de aquí, con los datos para copiar y el monto
 * exacto. Recibe nombre y link como nodos para que el hero ponga los del
 * negocio que la persona escribió.
 */
export function CheckoutScreen({
  name,
  slug,
  method,
  total,
  rate,
}: {
  name: React.ReactNode;
  slug: React.ReactNode;
  method: PayMethod;
  total: number;
  rate: number | null;
}) {
  const amount = method === "pm" && rate ? bs(total, rate) : usd(total);
  const rows: [string, string][] = {
    pm: [
      ["Teléfono", "0414 ••• 45 67"],
      ["Cédula", "V-••.•••.678"],
      ["Monto", amount],
    ] as [string, string][],
    zelle: [
      ["Email", "pagos@•••••.com"],
      ["Titular", "M. González"],
      ["Monto", amount],
    ] as [string, string][],
    binance: [
      ["Pay ID", "38•• ••• 112"],
      ["Moneda", "USDT"],
      ["Monto", amount],
    ] as [string, string][],
  }[method];

  return (
    <>
      <Url slug={slug} />
      <Top>
        <Brand>{name}</Brand>
        <span>Checkout</span>
      </Top>
      <Body>
        <div className="flex shrink-0 items-center gap-1.5 text-[8.5px] font-bold">
          <span className="flex items-center gap-[5px]">
            <i className="grid size-4 place-items-center rounded-full bg-[color:var(--p)] text-[color:var(--pi)]">
              <Check className="size-[9px]" strokeWidth={3} />
            </i>
            Entrega
          </span>
          <span className="h-0.5 flex-1 rounded-full bg-[color:var(--p)] opacity-35" />
          <span className="flex items-center gap-[5px]">
            <i className="grid size-4 place-items-center rounded-full bg-[color:var(--p)] text-[8px] not-italic text-[color:var(--pi)]">
              2
            </i>
            Pago
          </span>
        </div>
        <p className="font-[family-name:var(--sf)] text-[12.5px] font-bold leading-tight">¿Cómo vas a pagar?</p>
        <div className="grid gap-[5px]">
          {METHODS.map((m) => {
            const on = m.id === method;
            return (
              <span
                key={m.id}
                className={cn(
                  "flex items-center gap-[7px] rounded-[9px] border px-[9px] py-[7px] text-[9.5px] font-semibold",
                  on ? "border-[color:var(--p)] shadow-[inset_0_0_0_1px_var(--p)]" : "border-black/[0.12]",
                )}
              >
                <i
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border-[1.5px]",
                    on ? "border-[color:var(--p)] bg-[radial-gradient(circle,var(--p)_42%,transparent_48%)]" : "border-black/30",
                  )}
                />
                {m.label}
              </span>
            );
          })}
        </div>
        <div className="grid gap-1.5 rounded-[10px] bg-black/[0.045] px-[9px] py-2">
          {rows.map(([k, v], i) => (
            <div key={k} className="flex items-center justify-between gap-1.5 text-[8.5px]">
              <span className="opacity-60">{k}</span>
              <b
                className={cn(
                  "flex items-center gap-[5px] font-landing-mono font-semibold leading-none",
                  i === rows.length - 1 ? "text-[10.5px] text-[color:var(--p)]" : "text-[9px]",
                )}
              >
                {v}
                <Copy className="size-2.5 opacity-50" strokeWidth={1.8} />
              </b>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-black/15 px-[9px] py-[7px] text-[8.5px] opacity-70">
          N° de referencia / confirmación
        </div>
        <Button>
          <Lock strokeWidth={2} />
          Confirmar pedido · {usd(total)}
        </Button>
      </Body>
    </>
  );
}

/** 5. El pedido recibido, con el comprobante cargado y el aviso por WhatsApp. */
export function DoneScreen({ store, rate }: { store: ExampleStore; rate: number | null }) {
  const total = cartTotal(store);
  return (
    <>
      <Url slug={store.slug} />
      <Top>
        <Brand>{store.name}</Brand>
        <Bag />
      </Top>
      <Body className="items-center gap-2 text-center">
        <span className="mt-2 grid size-[46px] shrink-0 place-items-center rounded-full bg-success-surface text-success-text">
          <Check className="size-[22px]" strokeWidth={2.8} />
        </span>
        <p className="font-[family-name:var(--sf)] text-lg font-extrabold leading-none">Pedido #{store.order}</p>
        <span className="rounded-full bg-warning-surface px-[9px] py-1 text-[8.5px] font-bold text-warning-text">
          Por confirmar
        </span>
        <p className="max-w-[25ch] text-[9px] leading-[1.45] opacity-70">
          Recibimos tu pedido y tu comprobante. La tienda va a verificar el pago y confirmarlo a la brevedad.
        </p>
        <div className="flex w-full items-center gap-2 rounded-[10px] border border-dashed border-black/20 p-2 text-left">
          <span className="grid h-10 w-[30px] shrink-0 content-start gap-[3px] rounded-[5px] border border-black/10 bg-white px-1 py-[5px]">
            <i className="h-0.5 rounded-full bg-black/20" />
            <i className="h-0.5 rounded-full bg-black/20" />
            <i className="h-0.5 w-3/5 rounded-full bg-success-text" />
            <i className="h-0.5 rounded-full bg-black/20" />
          </span>
          <div>
            <b className="block text-[9.5px] text-success-text">Comprobante cargado</b>
            <span className="text-[8px] opacity-60">
              {METHOD_LABEL[store.method]} · {store.method === "pm" && rate ? bs(total, rate) : usd(total)}
            </span>
          </div>
        </div>
        <div className="flex w-full justify-between border-t border-black/[0.08] pt-1.5 text-[9px]">
          <span>Total</span>
          <b className="font-landing-mono text-[10px] font-semibold">{usd(total)}</b>
        </div>
        <Button className="w-full text-[9px]">
          <MessageCircle strokeWidth={2} />
          Avisar a la tienda por WhatsApp
        </Button>
      </Body>
    </>
  );
}
