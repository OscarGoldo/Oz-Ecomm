"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Clock, Loader2, MessageCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dismissCart, markCartContacted } from "@/app/(admin)/panel/carritos/actions";
import { formatUSD } from "@/lib/format";
import { abandonedCartMessage } from "@/lib/order-messages";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export type CartState = "pending" | "contacted" | "recovered" | "archived";

export interface BoardCart {
  id: string;
  state: CartState;
  name: string;
  phone: string;
  items: { name: string; variant: string | null; qty: number; price: number; cover: string | null }[];
  subtotal: number;
  /** "Hace 35 min", "Ayer", "Compró"… ya armado en el servidor. */
  age: string;
  heat: "hot" | "warm" | "cold" | "done";
  /** "Todavía no le escribiste", "Compró 1 h después de tu mensaje · pedido #1042"… */
  note: string;
  orderId: string | null;
}

export interface BoardCoupon {
  code: string;
  benefit: string;
}

const TABS: { id: CartState; label: string; empty: string }[] = [
  { id: "pending", label: "Por escribir", empty: "Estás al día: no hay carritos por escribir." },
  { id: "contacted", label: "Ya les escribiste", empty: "Nadie quedó esperando después de tu mensaje." },
  { id: "recovered", label: "Recuperados", empty: "Cuando alguien compre después de tu mensaje, aparece aquí." },
  { id: "archived", label: "Archivados", empty: "Nada archivado en los últimos 90 días." },
];

const HEAT = {
  hot: "bg-[#FFEDE3] text-[#A8401A]",
  warm: "bg-[#FFF4D6] text-[#8A5A00]",
  cold: "bg-[#EEF3F8] text-pizarra",
  done: "bg-[#DCFCE7] text-[#166534]",
} as const;

const AVATARS = [
  "bg-[#E0F2FE] text-[#0369A1]",
  "bg-[#FFEDE3] text-[#A8401A]",
  "bg-[#DCF5EA] text-[#11755A]",
  "bg-[#ECEAFB] text-[#3E2F9E]",
  "bg-[#FCE7EF] text-[#B8476E]",
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Las *negritas* de WhatsApp, como se van a ver allá. */
function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/\*([^*\n]+)\*/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))}
    </span>
  );
}

export function CartsBoard({
  carts,
  coupons,
  couponsAvailable,
  storeName,
  storeUrl,
  stuck,
  tip,
}: {
  carts: BoardCart[];
  coupons: BoardCoupon[];
  /** El plan tiene cupones (Pro). */
  couponsAvailable: boolean;
  storeName: string;
  storeUrl: string;
  /** Productos que más se quedan en carritos sin cerrar (30 días). */
  stuck: { name: string; count: number }[];
  tip: string;
}) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = carts.filter((c) => !hidden.has(c.id));
  const count = (s: CartState) => visible.filter((c) => c.state === s).length;
  const [tab, setTab] = useState<CartState>(() =>
    carts.some((c) => c.state === "pending") || !carts.some((c) => c.state === "contacted") ? "pending" : "contacted",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string>("");

  const inTab = visible.filter((c) => c.state === tab);
  const selected = inTab.find((c) => c.id === selectedId) ?? inTab[0] ?? null;
  const coupon = coupons.find((c) => c.code === couponCode) ?? null;

  const messageFor = useMemo(
    () => (c: BoardCart) =>
      abandonedCartMessage({
        storeName,
        customerName: c.name,
        items: c.items.map((i) => ({
          productName: i.name,
          variantName: i.variant,
          quantity: i.qty,
          subtotal: i.price * i.qty,
        })),
        subtotal: c.subtotal,
        storeUrl,
        coupon,
      }),
    [storeName, storeUrl, coupon],
  );

  /**
   * Abrir WhatsApp y marcarlo como escrito van juntos: si se marcara al volver
   * a la página, quien escribe desde el teléfono nunca quedaría marcado.
   */
  function contacted(id: string) {
    startBusy(async () => {
      await markCartContacted(id);
      router.refresh();
    });
  }

  function archive(c: BoardCart) {
    startBusy(async () => {
      const res = await dismissCart(c.id);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo archivar");
        return;
      }
      setHidden((prev) => new Set(prev).add(c.id));
      toast.success(`Archivaste el carrito de ${c.name.split(" ")[0]}`);
      router.refresh();
    });
  }

  if (carts.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
        <ShoppingCart className="mb-3 size-9 text-ink-400" />
        <p className="font-medium">No hay carritos pendientes</p>
        <p className="mt-1 max-w-md text-sm text-ink-500">
          Cuando alguien llene sus datos para pagar y no termine de comprar, aparece aquí para que le escribas.
        </p>
      </div>
    );
  }

  const couponPicker = couponsAvailable ? (
    <CouponPicker coupons={coupons} value={couponCode} onChange={setCouponCode} />
  ) : null;
  const open = tab === "pending" || tab === "contacted";

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSelectedId(null);
            }}
            aria-pressed={tab === t.id}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3.5 text-[13px] font-semibold text-pizarra transition-colors hover:border-[#C2CFDC] hover:text-foreground",
              tab === t.id && "border-noche bg-noche text-white hover:border-noche hover:text-white",
            )}
          >
            {t.label}
            <span className={cn("font-landing-mono text-xs tabular-nums", tab === t.id ? "text-niebla" : "text-ink-400")}>
              {count(t.id)}
            </span>
          </button>
        ))}
      </div>

      {/* Sin la columna de al lado, el cupón se elige arriba de la lista. */}
      {open && couponPicker && inTab.length > 0 && <div className="xl:hidden">{couponPicker}</div>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          {inTab.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-ink-500">
              {TABS.find((t) => t.id === tab)!.empty}
            </p>
          ) : (
            inTab.map((c) => (
              <CartCard
                key={c.id}
                cart={c}
                selected={selected?.id === c.id}
                onSelect={() => setSelectedId(c.id)}
                waHref={whatsappUrl(c.phone, messageFor(c))}
                onContacted={() => contacted(c.id)}
                onArchive={() => archive(c)}
                busy={busy}
              />
            ))
          )}
        </div>

        <aside className="hidden min-w-0 flex-col gap-5 xl:flex">
          {selected && (
            <MessagePanel
              cart={selected}
              message={messageFor(selected)}
              waHref={whatsappUrl(selected.phone, messageFor(selected))}
              couponPicker={couponPicker}
              onContacted={() => contacted(selected.id)}
            />
          )}
          <Insights stuck={stuck} tip={tip} />
        </aside>
      </div>

      <div className="flex flex-col gap-5 xl:hidden">
        <Insights stuck={stuck} tip={tip} />
      </div>
    </div>
  );
}

function CartCard({
  cart: c,
  selected,
  onSelect,
  waHref,
  onContacted,
  onArchive,
  busy,
}: {
  cart: BoardCart;
  selected: boolean;
  onSelect: () => void;
  waHref: string | null;
  onContacted: () => void;
  onArchive: () => void;
  busy: boolean;
}) {
  const open = c.state === "pending" || c.state === "contacted";
  const units = c.items.reduce((s, i) => s + i.qty, 0);
  const shown = c.items.slice(0, 3);
  return (
    <article
      onClick={onSelect}
      className={cn(
        "flex cursor-default flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-[border-color,box-shadow] sm:px-[18px] sm:py-4 xl:cursor-pointer xl:hover:border-[#C2CFDC]",
        selected && "xl:border-brand-600 xl:shadow-[0_0_0_3px_rgba(2,132,199,0.14)] xl:hover:border-brand-600",
        c.state === "archived" && "opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
            AVATARS[hash(c.name) % AVATARS.length],
          )}
          aria-hidden="true"
        >
          {initials(c.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <b className="truncate text-[15px]">{c.name}</b>
            <span className={cn("inline-flex h-[21px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-bold", HEAT[c.heat])}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {c.age}
            </span>
          </p>
          <p className="truncate font-landing-mono text-xs text-ink-500">{c.phone}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em] tabular-nums sm:text-[22px]">
            {formatUSD(c.subtotal)}
          </p>
          <p className="text-xs text-ink-500">{units === 1 ? "1 producto" : `${units} productos`}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {shown.map((i, n) => (
          <li key={n} className="flex items-center gap-2.5 text-[13.5px]">
            <span
              className={cn(
                "relative grid size-[30px] shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-extrabold",
                !i.cover && AVATARS[hash(i.name) % AVATARS.length],
              )}
              aria-hidden="true"
            >
              {i.cover ? <Image src={i.cover} alt="" fill sizes="30px" className="object-cover" /> : i.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {i.qty}× {i.name}
              {i.variant && <span className="text-[12.5px] text-ink-500"> · {i.variant}</span>}
            </span>
            <span className="font-landing-mono text-[12.5px] tabular-nums text-pizarra">{formatUSD(i.price * i.qty)}</span>
          </li>
        ))}
        {c.items.length > shown.length && (
          <li className="pl-10 text-xs text-ink-500">y {c.items.length - shown.length} más</li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-[#EEF3F8] pt-3">
        <p className="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 text-[12.5px] text-ink-500 sm:flex-[1_1_0%]">
          {c.state === "recovered" && <Check className="size-3.5 shrink-0 text-[#16A34A]" aria-hidden="true" />}
          {c.state === "contacted" && <Clock className="size-3.5 shrink-0" aria-hidden="true" />}
          <span>{c.note}</span>
          {c.state === "recovered" && c.orderId && (
            <Link
              href={`/panel/pedidos/${c.orderId}`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 font-semibold text-brand-700 hover:underline"
            >
              Ver pedido
            </Link>
          )}
        </p>
        {open && (
          <div className="flex w-full gap-2 sm:w-auto" onClick={(e) => e.stopPropagation()}>
            {waHref ? (
              <Button asChild className="h-11 flex-1 sm:h-9 sm:flex-none" disabled={busy}>
                <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={onContacted}>
                  <MessageCircle />
                  <span className="sm:hidden">Escribir por WhatsApp</span>
                  <span className="hidden sm:inline">{c.state === "contacted" ? "Escribir de nuevo" : "Escribir"}</span>
                </a>
              </Button>
            ) : (
              <span className="flex-1 text-xs text-ink-500 sm:flex-none">Este teléfono no sirve para WhatsApp</span>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0 sm:size-9"
              onClick={onArchive}
              disabled={busy}
              aria-label={`Archivar el carrito de ${c.name}`}
              title="Archivar"
            >
              {busy ? <Loader2 className="animate-spin" /> : <Archive />}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function MessagePanel({
  cart: c,
  message,
  waHref,
  couponPicker,
  onContacted,
}: {
  cart: BoardCart;
  message: string;
  waHref: string | null;
  couponPicker: ReactNode;
  onContacted: () => void;
}) {
  const first = c.name.trim().split(/\s+/)[0] || c.name;
  const open = c.state === "pending" || c.state === "contacted";
  return (
    <section aria-labelledby="mensaje" className="flex flex-col gap-3.5 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-2.5">
        <h2 id="mensaje" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {open ? `Mensaje para ${first}` : c.state === "recovered" ? "Recuperado" : "Archivado"}
        </h2>
        {open && <span className="font-landing-mono text-[11.5px] text-ink-500">WhatsApp</span>}
      </div>
      {open ? (
        <>
          <div className="rounded-[14px_14px_4px_14px] bg-[#E3F6D9] px-3.5 py-3 text-[13.5px] leading-normal text-[#16301A]">
            <WhatsAppText text={message} />
          </div>
          {couponPicker}
          {waHref ? (
            <Button asChild className="h-11 text-[15px]">
              <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={onContacted}>
                <MessageCircle /> Abrir WhatsApp con este mensaje
              </a>
            </Button>
          ) : (
            <p className="text-sm text-ink-500">El teléfono que dejó no sirve para WhatsApp.</p>
          )}
          <p className="-mt-1 text-[12.5px] leading-[1.45] text-ink-500">
            Al abrirlo queda marcado como escrito, para que no le insistas dos veces el mismo día.
          </p>
        </>
      ) : (
        <p className="text-sm leading-normal text-pizarra">{c.note}.</p>
      )}
    </section>
  );
}

function CouponPicker({
  coupons,
  value,
  onChange,
}: {
  coupons: BoardCoupon[];
  value: string;
  onChange: (code: string) => void;
}) {
  if (coupons.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-3 py-2.5 text-[13px] text-ink-500">
        ¿Quieres regalar un descuento en el mensaje?{" "}
        <Link href="/panel/descuentos" className="font-semibold text-brand-700 hover:underline">
          Crea un cupón
        </Link>{" "}
        y lo ofreces desde aquí.
      </p>
    );
  }
  const on = value !== "";
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        onClick={() => onChange(on ? "" : coupons[0]!.code)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-[13.5px]"
      >
        <span
          className={cn(
            "grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-niebla",
            on && "border-brand-600 bg-brand-600 text-white",
          )}
          aria-hidden="true"
        >
          {on && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          Ofrecer un cupón
          {on && coupons.length === 1 && (
            <>
              {" "}
              <b className="font-landing-mono">{coupons[0]!.code}</b>{" "}
              <span className="text-ink-500">({coupons[0]!.benefit})</span>
            </>
          )}
        </span>
      </button>
      {on && coupons.length > 1 && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] font-landing-mono text-[13px]" aria-label="Cupón a ofrecer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {coupons.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.benefit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function Insights({ stuck, tip }: { stuck: { name: string; count: number }[]; tip: string }) {
  const max = Math.max(1, ...stuck.map((s) => s.count));
  return (
    <>
      {stuck.length > 0 && (
        <section aria-labelledby="se-queda" className="rounded-2xl border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2.5">
            <h2 id="se-queda" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              Lo que más se queda en carritos
            </h2>
            <span className="font-landing-mono text-xs text-ink-500">30 días</span>
          </div>
          <ul className="mt-3.5 flex flex-col gap-2.5">
            {stuck.map((s) => (
              <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_90px_56px] items-center gap-2.5 text-[13px]">
                <span className="truncate font-semibold text-pizarra">{s.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#EEF3F8]">
                  <span
                    className="block h-full rounded-r-[4px] bg-brand-600"
                    style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                  />
                </span>
                <span className="text-right font-landing-mono text-[12.5px] font-semibold tabular-nums">
                  {s.count} {s.count === 1 ? "vez" : "veces"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-[1.45] text-ink-500">
            Si siempre se queda el mismo, mira su envío o su precio: algo frena al final.
          </p>
        </section>
      )}
      <section className="flex items-start gap-3 rounded-2xl bg-noche p-5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-sol/15 text-sol" aria-hidden="true">
          <Clock className="size-[15px]" />
        </span>
        <p className="text-[13.5px] leading-normal text-[#D7E1EB]">
          <b className="text-white">Escribe pronto.</b> {tip}
        </p>
      </section>
    </>
  );
}
