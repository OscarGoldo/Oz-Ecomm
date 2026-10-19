"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Mail, MessageCircle, Phone, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEGMENT_META, type CustomerSegment as Segment } from "@/lib/customer-segments";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export interface ClientRow {
  phone: string;
  name: string;
  email: string | null;
  sales: number;
  spentUsd: number;
  segment: Segment;
  /** "Hace 4 días": su último pedido. */
  lastLabel: string;
  /** "Cliente desde marzo 2026". */
  sinceLabel: string;
  favorites: { name: string; qty: number }[];
  orders: { id: string; number: number; dateLabel: string; statusLabel: string; total: number }[];
  detailHref: string;
}

export interface SegmentTab {
  id: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
  dot: string;
}

const AVATARS = [
  "bg-[#E0F2FE] text-[#0369A1]",
  "bg-[#FFEDE3] text-[#A8401A]",
  "bg-[#DCF5EA] text-[#11755A]",
  "bg-[#ECEAFB] text-[#3E2F9E]",
  "bg-[#FCE7EF] text-[#B8476E]",
];

function avatarClass(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATARS[Math.abs(h) % AVATARS.length]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function SegmentChip({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-bold", m.className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {m.label}
    </span>
  );
}

export function CustomersBoard({
  segments,
  rows,
  footer,
  storeName,
  storeUrl,
  coupon,
}: {
  segments: SegmentTab[];
  rows: ClientRow[];
  footer: string;
  storeName: string;
  storeUrl: string;
  /** Un cupón activo para el mensaje de "volver". */
  coupon: { code: string; benefit: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const selected = rows.find((r) => r.phone === selectedPhone) ?? rows[0] ?? null;
  const maxSpent = Math.max(1, ...rows.map((r) => r.spentUsd));

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q.trim()) sp.set("q", q.trim());
      else sp.delete("q");
      sp.delete("ver");
      startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /** Con la ficha al lado (pantallas grandes) se elige; si no, se abre la ficha. */
  function open(r: ClientRow) {
    if (window.matchMedia("(min-width: 1280px)").matches) setSelectedPhone(r.phone);
    else router.push(r.detailHref);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Tipos de cliente" className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:w-auto md:flex-wrap md:px-0">
          {segments.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              scroll={false}
              aria-current={s.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3.5 text-[13px] font-semibold text-pizarra transition-colors hover:border-[#C2CFDC] hover:text-foreground",
                s.active && "border-noche bg-noche text-white hover:border-noche hover:text-white",
              )}
            >
              <span className="size-[7px] rounded-full" style={{ background: s.dot }} aria-hidden="true" />
              {s.label}
              <span className={cn("font-landing-mono text-xs tabular-nums", s.active ? "text-niebla" : "text-ink-400")}>
                {s.count}
              </span>
            </Link>
          ))}
        </nav>
        <div className="relative w-full md:ml-auto md:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o teléfono"
            aria-label="Buscar clientes"
            className="h-10 bg-card pl-9"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <Users className="mb-3 size-9 text-ink-400" />
          <p className="font-medium">Nadie por aquí</p>
          <p className="mt-1 text-sm text-ink-500">Prueba con otra búsqueda u otro tipo de cliente.</p>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
          <section aria-label="Clientes" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
            {/* Escritorio: columnas. */}
            <div className="hidden grid-cols-[minmax(0,1fr)_64px_120px_100px_128px_36px] items-center gap-3 border-b border-[#EEF3F8] px-4 py-2.5 font-landing-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-400 md:grid">
              <span className="pl-12">Cliente</span>
              <span className="text-right">Pedidos</span>
              <span>Gastado</span>
              <span>Último</span>
              <span>Tipo</span>
              <span />
            </div>
            <ul className="divide-y divide-[#EEF3F8]">
              {rows.map((r) => {
                const isSel = selected?.phone === r.phone;
                const wa = whatsappUrl(r.phone);
                return (
                  <li
                    key={r.phone}
                    onClick={() => open(r)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-[#FAFCFE] md:grid md:grid-cols-[minmax(0,1fr)_64px_120px_100px_128px_36px] md:px-4 md:py-2.5",
                      isSel && "xl:bg-[#F0F8FE] xl:shadow-[inset_3px_0_0_#0284C7] xl:hover:bg-[#F0F8FE]",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold md:size-9", avatarClass(r.name))} aria-hidden="true">
                        {initials(r.name)}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={r.detailHref}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-[15px] font-bold hover:underline md:text-[14.5px]"
                        >
                          {r.name}
                        </Link>
                        <span className="hidden truncate font-landing-mono text-[11.5px] text-ink-500 md:block">{r.phone}</span>
                        {/* Teléfono: tipo y último pedido debajo del nombre. */}
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-500 md:hidden">
                          <SegmentChip segment={r.segment} />
                          <span className="truncate">{r.lastLabel.toLowerCase()}</span>
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right md:hidden">
                      <span className="block font-display text-[17px] font-extrabold tabular-nums">{formatUSD(r.spentUsd).replace(/\.00$/, "")}</span>
                      <span className="block text-xs text-ink-500">{r.sales === 1 ? "1 pedido" : `${r.sales} pedidos`}</span>
                    </span>
                    <span className="hidden text-right font-landing-mono text-sm font-semibold tabular-nums md:block">{r.sales || "—"}</span>
                    <span className="hidden flex-col gap-1 md:flex">
                      <span className="font-landing-mono text-[13.5px] font-semibold tabular-nums">{formatUSD(r.spentUsd)}</span>
                      <span className="h-[5px] overflow-hidden rounded-full bg-[#EEF3F8]">
                        <span
                          className="block h-full rounded-r-[3px] bg-brand-600"
                          style={{ width: `${Math.max(r.spentUsd > 0 ? 4 : 0, Math.round((r.spentUsd / maxSpent) * 100))}%` }}
                        />
                      </span>
                    </span>
                    <span className="hidden text-[13px] text-pizarra md:block">{r.lastLabel}</span>
                    <span className="hidden md:block">
                      <SegmentChip segment={r.segment} />
                    </span>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="grid size-11 shrink-0 place-items-center rounded-full bg-noche text-white transition-opacity hover:opacity-90 md:size-[34px]"
                        aria-label={`Escribirle a ${r.name} por WhatsApp`}
                      >
                        <MessageCircle className="size-[18px] md:size-[15px]" />
                      </a>
                    ) : (
                      <span className="size-11 md:size-[34px]" />
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-[#EEF3F8] px-4 py-3 text-[12.5px] text-ink-500">{footer}</p>
          </section>

          {selected && (
            <div className="hidden xl:block">
              <CustomerPanel customer={selected} storeName={storeName} storeUrl={storeUrl} coupon={coupon} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Template = "gracias" | "nuevo" | "volver";

function defaultTemplate(segment: Segment): Template {
  if (segment === "sleep") return "volver";
  if (segment === "new" || segment === "one" || segment === "none") return "gracias";
  return "nuevo";
}

/**
 * La ficha del cliente: cuánto compró, qué compra y sus pedidos, con mensajes
 * listos para WhatsApp. Va al lado de la lista en pantallas grandes y como
 * página propia (`/panel/clientes/[teléfono]`) en las demás.
 */
export function CustomerPanel({
  customer: c,
  storeName,
  storeUrl,
  coupon,
  compact = false,
}: {
  customer: ClientRow;
  storeName: string;
  storeUrl: string;
  coupon: { code: string; benefit: string } | null;
  /** Al lado de la lista: tres pedidos y un enlace a la ficha completa. */
  compact?: boolean;
}) {
  const [picked, setPicked] = useState<{ phone: string; tpl: Template } | null>(null);
  const tpl = picked?.phone === c.phone ? picked.tpl : defaultTemplate(c.segment);
  const first = c.name.trim().split(/\s+/)[0] || c.name;
  const texts: Record<Template, { label: string; text: string }> = {
    gracias: {
      label: "Agradecer",
      text: `¡Hola ${first}! Gracias por tu compra en *${storeName}*. Si necesitas algo con tu pedido, me escribes por aquí.`,
    },
    nuevo: {
      label: "Contarle lo nuevo",
      text: `¡Hola ${first}! Te escribo de *${storeName}*: tenemos cosas nuevas y me acordé de ti. Míralas aquí: ${storeUrl}`,
    },
    volver: {
      label: coupon ? "Volver con un cupón" : "Invitarle a volver",
      text: coupon
        ? `¡Hola ${first}! Hace rato no te vemos por *${storeName}*. Te guardé el código *${coupon.code}* con ${coupon.benefit} en tu próxima compra: ${storeUrl}`
        : `¡Hola ${first}! Hace rato no te vemos por *${storeName}*. Pasa a ver lo nuevo, seguro algo te gusta: ${storeUrl}`,
    },
  };
  const message = texts[tpl].text;
  const wa = whatsappUrl(c.phone, message);
  const orders = compact ? c.orders.slice(0, 3) : c.orders;
  const ticket = c.sales > 0 ? c.spentUsd / c.sales : 0;

  return (
    <section aria-label={`Ficha de ${c.name}`} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-base font-bold", avatarClass(c.name))} aria-hidden="true">
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-extrabold tracking-[-0.02em]">{c.name}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-500">
            <SegmentChip segment={c.segment} />
            {c.sinceLabel}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-pizarra">
        <span className="inline-flex items-center gap-1.5 font-landing-mono">
          <Phone className="size-3.5 text-ink-400" aria-hidden="true" /> {c.phone}
        </span>
        {c.email && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" /> <span className="truncate">{c.email}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Pedidos", v: String(c.sales) },
          { l: "Gastado", v: `$${Math.round(c.spentUsd).toLocaleString("en-US")}` },
          // Sin centavos: en una cajita de 90 px, "$163.43" se corta.
          { l: "Por pedido", v: c.sales > 0 ? `$${Math.round(ticket).toLocaleString("en-US")}` : "—" },
        ].map((s) => (
          <div key={s.l} className="min-w-0 rounded-xl bg-claro px-3 py-2.5">
            <p className="text-[11.5px] font-semibold text-pizarra">{s.l}</p>
            <p className="truncate font-display text-lg font-extrabold tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      {c.favorites.length > 0 && (
        <div>
          <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Lo que más compra</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {c.favorites.map((f) => (
              <span key={f.name} className="inline-flex h-7 max-w-full items-center rounded-full border border-[#E7EFF7] bg-claro px-2.5 text-[12.5px] font-semibold">
                <span className="truncate">{f.name}</span>
                {f.qty > 1 && <span className="ml-1 shrink-0 text-ink-500">×{f.qty}</span>}
              </span>
            ))}
          </p>
        </div>
      )}

      <div>
        <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {compact ? "Últimos pedidos" : "Sus pedidos"}
        </p>
        <ul className="mt-1.5">
          {orders.map((o) => (
            <li key={o.id} className="border-t border-[#EEF3F8] first:border-t-0">
              <Link href={`/panel/pedidos/${o.id}`} className="flex items-center gap-2.5 py-2 text-[13px] hover:text-brand-700">
                <span className="font-landing-mono font-semibold">#{o.number}</span>
                <span className="min-w-0 flex-1 truncate text-ink-500">
                  {o.dateLabel} · {o.statusLabel.toLowerCase()}
                </span>
                <span className="font-landing-mono font-semibold tabular-nums">{formatUSD(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {compact && (
          <Link href={c.detailHref} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Ver la ficha completa <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[#EEF3F8] pt-3.5">
        <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">Escribirle</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Qué mensaje mandarle">
          {(Object.keys(texts) as Template[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPicked({ phone: c.phone, tpl: t })}
              aria-pressed={tpl === t}
              className={cn(
                "h-9 whitespace-nowrap rounded-[10px] border bg-card px-3 text-[13px] font-semibold text-pizarra transition-colors hover:border-[#C2CFDC]",
                tpl === t && "border-brand-600 bg-[#F0F8FE] text-[#075985] hover:border-brand-600",
              )}
            >
              {texts[t].label}
            </button>
          ))}
        </div>
        <div className="rounded-[14px_14px_4px_14px] bg-[#E3F6D9] px-3.5 py-3 text-[13.5px] leading-normal text-[#16301A]">
          {message.split(/\*([^*\n]+)\*/g).map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p))}
        </div>
        {wa ? (
          <Button asChild className="h-11 text-[14.5px]">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Abrir WhatsApp
            </a>
          </Button>
        ) : (
          <p className="text-sm text-ink-500">Este teléfono no sirve para WhatsApp.</p>
        )}
      </div>
    </section>
  );
}
