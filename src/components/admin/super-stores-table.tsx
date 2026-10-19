"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  MessageCircle,
  Search,
  Store as StoreIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatUSD } from "@/lib/format";
import type { PlanBadge } from "@/lib/super-format";
import {
  SEGMENT_LABEL,
  SEGMENT_ORDER,
  type StoreSegment,
} from "@/lib/super-segments";
import { cn } from "@/lib/utils";

/**
 * Una tienda lista para mostrar. Las fechas llegan ya escritas desde el
 * servidor (ver super-format.ts); las crudas quedan solo para ordenar.
 */
export interface StoreRow {
  id: string;
  slug: string;
  /** La dirección pública: https://mitienda.usatiendify.com */
  url: string;
  name: string;
  whatsapp: string | null;
  waUrl: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: PlanBadge;
  /** "pausada" / "cerrada por el dueño", si no está en línea. */
  offlineLabel: string | null;
  segments: StoreSegment[];
  createdAt: string;
  createdLabel: string;
  createdFull: string;
  activityAt: string | null;
  activityLabel: string;
  products: number;
  sales: number;
  gmv: number;
  paidTotal: number;
  owed: number;
  /** "código INFLU10" / "referida por Dulce Arepa". */
  origin: string | null;
  note: string | null;
}

type SortKey =
  | "name"
  | "created"
  | "activity"
  | "products"
  | "sales"
  | "gmv"
  | "paid";

const SORT_LABEL: Record<SortKey, string> = {
  created: "Más nuevas",
  activity: "Actividad reciente",
  gmv: "Más GMV",
  sales: "Más ventas",
  paid: "Más pagado a Tiendify",
  products: "Más productos",
  name: "Nombre",
};

/** Sin tildes ni mayúsculas: "Mendez" tiene que encontrar a "Méndez". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function compare(a: StoreRow, b: StoreRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "es");
    case "created":
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    case "activity":
      // Una tienda sin actividad cuenta como la más vieja de todas.
      return (
        (a.activityAt ? Date.parse(a.activityAt) : 0) -
        (b.activityAt ? Date.parse(b.activityAt) : 0)
      );
    case "products":
      return a.products - b.products;
    case "sales":
      return a.sales - b.sales;
    case "gmv":
      return a.gmv - b.gmv;
    case "paid":
      return a.paidTotal - b.paidTotal;
  }
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: StoreRow[]) {
  const header = [
    "Tienda",
    "Enlace",
    "Dueño",
    "Correo",
    "WhatsApp",
    "Plan",
    "Estado del plan",
    "En línea",
    "Creada",
    "Última actividad",
    "Productos",
    "Ventas",
    "GMV (USD)",
    "Pagado a Tiendify (USD)",
    "Por pagarle (USD)",
    "Origen",
    "Nota",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.slug,
      r.ownerName,
      r.ownerEmail,
      r.whatsapp,
      r.plan.label,
      r.plan.sub,
      r.offlineLabel ?? "sí",
      r.createdFull,
      r.activityLabel,
      r.products,
      r.sales,
      r.gmv.toFixed(2),
      r.paidTotal.toFixed(2),
      r.owed.toFixed(2),
      r.origin,
      r.note,
    ]
      .map(csvCell)
      .join(","),
  );
  // El BOM es para Excel: sin él las tildes salen rotas.
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tiendas-tiendify-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  rows: StoreRow[];
  initialQuery?: string;
  initialSegment?: StoreSegment | null;
  /** false = falta la migración 0030 y los números vienen en cero. */
  complete: boolean;
}

export function SuperStoresTable({
  rows,
  initialQuery = "",
  initialSegment = null,
  complete,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [segment, setSegment] = useState<StoreSegment | null>(initialSegment);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "created",
    desc: true,
  });

  const counts = useMemo(() => {
    const c = new Map<StoreSegment, number>();
    for (const r of rows) {
      for (const s of r.segments) c.set(s, (c.get(s) ?? 0) + 1);
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    const digits = q.replace(/\D/g, "").replace(/^0+/, "");
    const out = rows.filter((r) => {
      if (segment && !r.segments.includes(segment)) return false;
      if (!q) return true;
      const haystack = fold(
        [r.name, r.slug, r.ownerName, r.ownerEmail, r.whatsapp, r.origin, r.note]
          .filter(Boolean)
          .join(" "),
      );
      if (haystack.includes(q)) return true;
      // "0424 123 45 67" tiene que encontrar a "584241234567".
      return (
        digits.length >= 4 &&
        (r.whatsapp ?? "").replace(/\D/g, "").includes(digits)
      );
    });
    out.sort((a, b) => {
      const d = compare(a, b, sort.key);
      return sort.desc ? -d : d;
    });
    return out;
  }, [rows, query, segment, sort]);

  function toggleSort(key: SortKey) {
    setSort((cur) =>
      cur.key === key
        ? { key, desc: !cur.desc }
        : // El nombre arranca de la A; todo lo demás, de mayor a menor.
          { key, desc: key !== "name" },
    );
  }

  const filtered = query.trim() !== "" || segment !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="stores-filter" className="sr-only">
            Filtrar esta lista
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            id="stores-filter"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nombre, dueño, correo, WhatsApp o código"
            autoComplete="off"
            className={cn(
              "h-10 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-base md:text-sm",
              "placeholder:text-muted-foreground/80",
              "outline-none transition-[border-color,box-shadow] duration-150 ease-out",
              "focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]",
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
        </div>

        {/* En la tabla se ordena tocando el encabezado; en la lista del
            teléfono no hay encabezados, así que va este selector. */}
        <label className="lg:hidden">
          <span className="sr-only">Ordenar por</span>
          <select
            value={sort.key}
            onChange={(e) => {
              const key = e.target.value as SortKey;
              setSort({ key, desc: key !== "name" });
            }}
            className="h-10 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => downloadCsv(visible)}
          disabled={visible.length === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-45"
        >
          <Download className="size-4" />
          <span className="sr-only sm:not-sr-only">Exportar</span>
        </button>
      </div>

      {/* Filtros. En el teléfono se deslizan de lado en vez de apilarse en
          tres renglones que empujan la lista fuera de la pantalla. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip
          label="Todas"
          count={rows.length}
          active={segment === null}
          onClick={() => setSegment(null)}
        />
        {SEGMENT_ORDER.map((s) => {
          const n = counts.get(s) ?? 0;
          // Un filtro que no trae nada es ruido, salvo que sea el que está puesto.
          if (n === 0 && segment !== s) return null;
          return (
            <Chip
              key={s}
              label={SEGMENT_LABEL[s]}
              count={n}
              active={segment === s}
              tone={s === "expiring" || s === "failed" ? "alert" : "plain"}
              onClick={() => setSegment(segment === s ? null : s)}
            />
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <StoreIcon className="mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {rows.length === 0
              ? "Todavía no hay tiendas"
              : "Ninguna tienda coincide"}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSegment(null);
              }}
              className="mt-3 text-sm font-medium underline underline-offset-4"
            >
              Quitar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla: de lg para arriba. */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {/* w-full + max-w-0 en la celda: la columna se queda con el
                      ancho que sobra y el texto largo se corta en vez de
                      empujar la tabla fuera de la pantalla. */}
                  <Th sort={sort} k="name" onSort={toggleSort} className="w-full">
                    Tienda y dueño
                  </Th>
                  <th className="px-2.5 py-2 text-2xs font-semibold text-ink-500">
                    Plan
                  </th>
                  <Th sort={sort} k="created" onSort={toggleSort}>
                    Creada
                  </Th>
                  <Th sort={sort} k="activity" onSort={toggleSort}>
                    Actividad
                  </Th>
                  <Th
                    sort={sort}
                    k="products"
                    onSort={toggleSort}
                    align="right"
                    className="hidden xl:table-cell"
                  >
                    Prod.
                  </Th>
                  <Th
                    sort={sort}
                    k="sales"
                    onSort={toggleSort}
                    align="right"
                    className="hidden xl:table-cell"
                  >
                    Ventas
                  </Th>
                  <Th sort={sort} k="gmv" onSort={toggleSort} align="right">
                    GMV
                  </Th>
                  <Th
                    sort={sort}
                    k="paid"
                    onSort={toggleSort}
                    align="right"
                    className="hidden xl:table-cell"
                  >
                    Pagado
                  </Th>
                  <th className="w-px px-2 py-2">
                    <span className="sr-only">Accesos</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/50">
                    <td className="w-full max-w-0 px-2.5 py-2.5">
                      <Link
                        href={`/super/tiendas/${r.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.ownerName ?? "Sin dueño asignado"}
                        {r.ownerEmail ? ` · ${r.ownerEmail}` : ""}
                      </p>
                      {(r.origin || r.note) && (
                        <p className="truncate text-2xs text-ink-400">
                          {[r.origin, r.note].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 align-top">
                      <Badge variant={r.plan.variant}>{r.plan.label}</Badge>
                      {/* "Pausada" va acá y no al lado del nombre: ahí le
                          comía el ancho justo a lo que hay que leer. */}
                      {r.offlineLabel && (
                        <p className="mt-0.5 text-2xs text-ink-400">
                          {r.offlineLabel}
                        </p>
                      )}
                      {r.plan.sub && (
                        <p
                          className={cn(
                            "mt-0.5 text-2xs",
                            r.plan.variant === "danger"
                              ? "text-destructive-text"
                              : "text-ink-400",
                          )}
                        >
                          {r.plan.sub}
                        </p>
                      )}
                    </td>
                    <td
                      className="whitespace-nowrap px-2.5 py-2.5 align-top tabular-nums"
                      title={r.createdFull}
                    >
                      {r.createdLabel}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2.5 py-2.5 align-top tabular-nums",
                        r.segments.includes("dormant") && "text-warning-text",
                      )}
                    >
                      {r.activityLabel}
                    </td>
                    <td className="hidden px-2.5 py-2.5 text-right align-top tabular-nums xl:table-cell">
                      {r.products}
                    </td>
                    <td className="hidden px-2.5 py-2.5 text-right align-top tabular-nums xl:table-cell">
                      {r.sales}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2.5 text-right align-top tabular-nums">
                      {formatUSD(r.gmv)}
                    </td>
                    <td className="hidden whitespace-nowrap px-2.5 py-2.5 text-right align-top tabular-nums xl:table-cell">
                      {r.paidTotal > 0 ? formatUSD(r.paidTotal) : "—"}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <RowLinks row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista: teléfono y tablet. */}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card lg:hidden">
            {visible.map((r) => (
              <li key={r.id} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/super/tiendas/${r.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    <Badge variant={r.plan.variant}>
                      {r.plan.label}
                      {r.plan.variant === "danger" && r.plan.sub
                        ? ` · ${r.plan.sub}`
                        : ""}
                    </Badge>
                    {r.offlineLabel && (
                      <Badge variant="neutral">{r.offlineLabel}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.ownerName ?? "Sin dueño asignado"}
                    {r.ownerEmail ? ` · ${r.ownerEmail}` : ""}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-ink-500">
                    Creada {r.createdLabel} ·{" "}
                    <span
                      className={cn(
                        r.segments.includes("dormant") && "text-warning-text",
                      )}
                    >
                      actividad {r.activityLabel}
                    </span>{" "}
                    · {r.sales} {r.sales === 1 ? "venta" : "ventas"} ·{" "}
                    {formatUSD(r.gmv)}
                  </p>
                  {(r.origin || r.note) && (
                    <p className="truncate text-2xs text-ink-400">
                      {[r.origin, r.note].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <RowLinks row={r} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {visible.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "tienda" : "tiendas"}`
          : `${visible.length} de ${rows.length} tiendas`}
        {!complete && " · sin ventas ni actividad hasta correr la migración 0030"}
      </p>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  tone = "plain",
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  tone?: "plain" | "alert";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[0.8125rem] font-medium",
        "transition-colors duration-150 ease-out",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-ink-600 hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "tabular-nums",
          active
            ? "text-background/70"
            : tone === "alert" && count > 0
              ? "font-semibold text-destructive-text"
              : "text-ink-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Th({
  children,
  k,
  sort,
  onSort,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <th
      aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
      className={cn("px-2.5 py-2", align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-2xs font-semibold transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-ink-500",
        )}
      >
        {children}
        <Icon className={cn("size-3", !active && "text-ink-300")} />
      </button>
    </th>
  );
}

/** Los dos atajos de cada fila: escribirle y ver su tienda. */
function RowLinks({ row }: { row: StoreRow }) {
  return (
    <div className="flex shrink-0 items-center justify-end">
      {row.waUrl && (
        <a
          href={row.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="grid size-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Escribirle a ${row.name} por WhatsApp`}
        >
          <MessageCircle className="size-4" />
        </a>
      )}
      <a
        href={row.url}
        target="_blank"
        rel="noopener noreferrer"
        className="grid size-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Ver la tienda ${row.name}`}
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}
