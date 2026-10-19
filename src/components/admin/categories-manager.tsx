"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  reorderCategories,
  setCategoryActive,
} from "@/app/(admin)/panel/categorias/actions";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CategoryItem {
  id: string;
  name: string;
  active: boolean;
  /** Productos a la venta: los que el cliente ve al entrar. */
  productCount: number;
  /** Borradores: todavía no se ven. */
  draftCount: number;
  /** Últimos 30 días. */
  salesUsd: number;
  units: number;
  /** Hasta tres fotos de sus productos, las de los que más venden primero. */
  thumbs: string[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Lo que dice la fila debajo del nombre. `warn` lo pinta de ámbar. */
function rowNote(c: CategoryItem): { text: string; warn: boolean } {
  const drafts = c.draftCount > 0 ? ` · ${plural(c.draftCount, "borrador", "borradores")}` : "";
  if (!c.active) return { text: `${plural(c.productCount, "producto", "productos")}${drafts} · oculta, tus clientes no la ven`, warn: false };
  if (c.productCount === 0) {
    return {
      text: c.draftCount > 0
        ? `Nada a la venta (${plural(c.draftCount, "borrador", "borradores")}) · sale en tu menú`
        : "Vacía · sale en tu menú sin productos",
      warn: true,
    };
  }
  return { text: `${plural(c.productCount, "producto", "productos")}${drafts}`, warn: false };
}

export function CategoriesManager({
  initial,
  storeName,
  aside,
}: {
  initial: CategoryItem[];
  storeName: string;
  /** Lo que va debajo de la vista previa del menú (ventas por categoría, consejos). */
  aside?: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);
  const [pending, startTransition] = useTransition();

  // Arrastrar: solo desde los puntitos, para que seleccionar texto o tocar el
  // switch no empiece un arrastre.
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const orderAtStart = useRef<string[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => setItems(initial), [initial]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function saveOrder(next: CategoryItem[]) {
    const res = await reorderCategories(next.map((c) => c.id));
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el orden");
      refresh();
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 2 || creating) return;
    setCreating(true);
    const res = await createCategory(name);
    setCreating(false);
    if (!res.ok) return toast.error(res.error ?? "No se pudo crear");
    setNewName("");
    toast.success(`Creaste “${name}”`);
    refresh();
  }

  function startEdit(c: CategoryItem) {
    setEditingId(c.id);
    setEditValue(c.name);
  }

  async function handleRename(id: string) {
    const name = editValue.trim();
    if (name.length < 2) return;
    const res = await renameCategory(id, name);
    if (!res.ok) return toast.error(res.error ?? "No se pudo renombrar");
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    setEditingId(null);
    refresh();
  }

  async function handleToggle(id: string, active: boolean) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
    const res = await setCategoryActive(id, active);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo actualizar");
      refresh();
    }
  }

  async function handleDelete(c: CategoryItem) {
    setDeleting(null);
    setEditingId(null);
    const res = await deleteCategory(c.id);
    if (!res.ok) return toast.error(res.error ?? "No se pudo borrar");
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    toast.success(`Borraste “${c.name}”`);
    refresh();
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next);
    void saveOrder(next);
  }

  function dragOver(overId: string) {
    if (!dragId || overId === dragId) return;
    setItems((prev) => {
      const from = prev.findIndex((c) => c.id === dragId);
      const to = prev.findIndex((c) => c.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  function dragEnd() {
    const before = orderAtStart.current;
    orderAtStart.current = null;
    setDragId(null);
    setArmedId(null);
    const now = itemsRef.current;
    if (before && before.join() !== now.map((c) => c.id).join()) void saveOrder(now);
  }

  const shownInMenu = items.filter((c) => c.active);
  const anyEmpty = shownInMenu.some((c) => c.productCount === 0);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <section aria-label="Tus categorías" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
        <form
          className="flex gap-2.5 bg-[#FAFCFE] p-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nueva categoría (ej. Calzado)"
            aria-label="Nombre de la nueva categoría"
            maxLength={60}
            className="h-11 min-w-0 flex-1 bg-card md:h-10"
          />
          <Button type="submit" disabled={newName.trim().length < 2 || creating} className="h-11 md:h-10">
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            <span className="hidden sm:inline">Crear</span>
          </Button>
        </form>

        {items.length === 0 ? (
          <div className="grid place-items-center border-t border-[#EEF3F8] px-6 py-12 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Tags className="size-6" />
            </span>
            <p className="font-medium">Todavía no tienes categorías</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Agrupa lo que vendes (Vestidos, Calzado, Accesorios…) y tus clientes encuentran más rápido lo que buscan.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden items-center gap-3 border-t border-[#EEF3F8] px-4 py-2 font-landing-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-400 md:flex">
              <span className="flex-1 pl-[138px]">Categoría</span>
              <span className="w-[104px] whitespace-nowrap text-right">Vendido 30 días</span>
              <span className="w-11 text-center">Ver</span>
              <span className="w-[62px] text-center">Orden</span>
              <span className="w-8" />
            </div>
            <ul>
              {items.map((c, i) => {
                const note = rowNote(c);
                const editing = editingId === c.id;
                return (
                  <li
                    key={c.id}
                    draggable={armedId === c.id}
                    onDragStart={(e) => {
                      setDragId(c.id);
                      orderAtStart.current = items.map((x) => x.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", c.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      dragOver(c.id);
                    }}
                    onDrop={(e) => e.preventDefault()}
                    onDragEnd={dragEnd}
                    className={cn(
                      "flex items-center gap-2.5 border-t border-[#EEF3F8] bg-card px-2.5 py-2.5 transition-colors md:gap-3 md:px-4 md:py-3",
                      !editing && "hover:bg-[#FAFCFE]",
                      dragId === c.id && "bg-[#F3F7FB] opacity-60",
                    )}
                  >
                    <span
                      className="hidden shrink-0 cursor-grab touch-none text-niebla active:cursor-grabbing md:grid"
                      onPointerDown={() => setArmedId(c.id)}
                      onPointerUp={() => !dragId && setArmedId(null)}
                      title="Arrastra para cambiar el orden"
                      aria-hidden="true"
                    >
                      <GripVertical className="size-4" />
                    </span>
                    <span className="hidden w-[22px] shrink-0 text-right font-landing-mono text-xs tabular-nums text-ink-400 md:block">
                      {i + 1}
                    </span>
                    <Thumbs thumbs={c.thumbs} dim={!c.active} />

                    {editing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Input
                          value={editValue}
                          autoFocus
                          maxLength={60}
                          aria-label={`Nuevo nombre para ${c.name}`}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleRename(c.id);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-10 min-w-0 flex-1"
                        />
                        <Button size="icon" className="size-10 shrink-0" onClick={() => handleRename(c.id)} aria-label="Guardar nombre">
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-10 shrink-0" onClick={() => setEditingId(null)} aria-label="Cancelar">
                          <X className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-10 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(c)}
                          aria-label={`Borrar ${c.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", !c.active && "opacity-60")}>
                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className="group flex min-w-0 items-center gap-1.5 text-left"
                            title="Cambiar el nombre"
                          >
                            <span className="truncate text-[15px] font-bold">{c.name}</span>
                            <Pencil className="size-3.5 shrink-0 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                          </button>
                          <p className={cn("text-[12.5px] leading-snug text-ink-500", note.warn && "font-semibold text-[#92400E]")}>
                            {note.text}
                            {/* En el teléfono no hay columna de ventas: va acá. */}
                            {c.salesUsd > 0 && <span className="md:hidden"> · {formatUSD(c.salesUsd)} en 30 días</span>}
                          </p>
                        </div>
                        <div className="hidden w-[104px] shrink-0 flex-col text-right md:flex">
                          <span className="font-landing-mono text-sm font-semibold tabular-nums">
                            {c.salesUsd > 0 ? formatUSD(c.salesUsd) : "—"}
                          </span>
                          <span className="text-[11.5px] text-ink-400">
                            {c.units > 0 ? plural(c.units, "vendido", "vendidos") : "sin ventas"}
                          </span>
                        </div>
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => handleToggle(c.id, v)}
                          aria-label={c.active ? `Ocultar ${c.name} de tu tienda` : `Mostrar ${c.name} en tu tienda`}
                          className="data-[state=checked]:bg-brand-600"
                        />
                        <div className="flex shrink-0 flex-col gap-0.5 md:flex-row">
                          <ArrowButton label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                            <ChevronUp className="size-3.5" />
                          </ArrowButton>
                          <ArrowButton label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                            <ChevronDown className="size-3.5" />
                          </ArrowButton>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="hidden size-8 shrink-0 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-[#F3F7FB] hover:text-foreground md:grid"
                              aria-label={`Más acciones para ${c.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => startEdit(c)}>
                              <Pencil className="size-4" /> Cambiar el nombre
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setDeleting(c)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4" /> Borrar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="flex items-center gap-2 border-t border-[#EEF3F8] px-4 py-3 text-[12.5px] leading-snug text-ink-500">
              {pending && <Loader2 className="size-3.5 shrink-0 animate-spin" aria-label="Guardando" />}
              <span className="hidden md:inline">
                Arrastra desde los puntitos o usa las flechas. Toca el nombre para cambiarlo; si borras una categoría, sus productos quedan sin categoría, no se borran.
              </span>
              <span className="md:hidden">
                Toca el nombre para cambiarlo o borrarla. Si la borras, sus productos quedan sin categoría.
              </span>
            </p>
          </>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        {items.length > 0 && (
          <section aria-labelledby="menu-preview" className="rounded-2xl border bg-card p-5">
            <h2 id="menu-preview" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              Así ve tu cliente el menú
            </h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-[#E7EFF7]">
              <div className="flex items-center justify-between border-b border-[#EEF3F8] px-3 py-2.5">
                <span className="truncate font-display text-base font-extrabold">{storeName}</span>
                <span className="h-[3px] w-[18px] shrink-0 rounded-sm bg-noche" aria-hidden="true" />
              </div>
              <ul className="flex flex-wrap gap-1.5 p-3" aria-label="Categorías en el menú">
                <li className="inline-flex h-[30px] items-center rounded-full bg-noche px-3 text-[13px] font-semibold text-white">
                  Todos
                </li>
                {shownInMenu.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "inline-flex h-[30px] items-center rounded-full border px-3 text-[13px] font-semibold",
                      c.productCount === 0
                        ? "border-dashed border-[#F0C46A] bg-[#FFFBEB] text-[#92400E]"
                        : "border-linea bg-card",
                    )}
                  >
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-[1.45] text-ink-500">
              {shownInMenu.length === 0
                ? "Todas están ocultas: tu tienda no muestra el menú de categorías."
                : "Cambia el orden o apaga una y mira cómo queda."}
              {anyEmpty && " Las punteadas no tienen nada a la venta: salen en el menú pero no muestran productos."}
            </p>
          </section>
        )}
        {aside}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.productCount + deleting.draftCount > 0
                ? `Sus ${plural(deleting.productCount + deleting.draftCount, "producto", "productos")} no se borran: quedan sin categoría.`
                : "No tiene productos. Deja de salir en el menú de tu tienda."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && handleDelete(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Thumbs({ thumbs, dim }: { thumbs: string[]; dim: boolean }) {
  if (thumbs.length === 0) {
    return (
      <span className="flex w-9 shrink-0 md:w-16" aria-hidden="true">
        <span className="size-9 rounded-[10px] border-[1.5px] border-dashed border-[#BFCEDD] bg-[#F7FAFC] md:size-[30px] md:rounded-lg" />
      </span>
    );
  }
  return (
    <span className={cn("flex w-9 shrink-0 md:w-16", dim && "opacity-50")} aria-hidden="true">
      {thumbs.map((src, i) => (
        <span
          key={src + i}
          className={cn(
            "relative overflow-hidden bg-claro",
            // Teléfono: una sola foto grande. Escritorio: hasta tres encimadas.
            i === 0
              ? "size-9 rounded-[10px] md:size-[30px] md:rounded-lg md:border-2 md:border-white md:shadow-[0_0_0_1px_#E7EFF7]"
              : "-ml-3 hidden size-[30px] rounded-lg border-2 border-white shadow-[0_0_0_1px_#E7EFF7] md:block",
          )}
        >
          <Image src={src} alt="" fill sizes="36px" className="object-cover" />
        </span>
      ))}
    </span>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-[22px] w-[34px] place-items-center rounded-[7px] border border-linea bg-card text-pizarra transition-colors enabled:hover:bg-[#F3F7FB] enabled:hover:text-foreground disabled:opacity-35 md:size-[30px] md:rounded-lg"
    >
      {children}
    </button>
  );
}
