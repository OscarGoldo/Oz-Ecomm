"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  reorderCategories,
  setCategoryActive,
} from "@/app/(admin)/panel/categorias/actions";

export interface CategoryItem {
  id: string;
  name: string;
  active: boolean;
  productCount: number;
}

export function CategoriesManager({ initial }: { initial: CategoryItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => setItems(initial), [initial]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 2) return;
    const res = await createCategory(name);
    if (!res.ok) return toast.error(res.error ?? "Error");
    setNewName("");
    toast.success("Categoría creada");
    refresh();
  }

  async function handleRename(id: string) {
    const name = editValue.trim();
    if (name.length < 2) return;
    const res = await renameCategory(id, name);
    if (!res.ok) return toast.error(res.error ?? "Error");
    setEditingId(null);
    toast.success("Categoría actualizada");
    refresh();
  }

  async function handleToggle(id: string, active: boolean) {
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active } : c)),
    );
    const res = await setCategoryActive(id, active);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      refresh();
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteCategory(id);
    if (!res.ok) return toast.error(res.error ?? "Error");
    toast.success("Categoría eliminada");
    refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    setItems(next);
    const res = await reorderCategories(next.map((c) => c.id));
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Nueva categoría (ej. Refrigeración)"
        />
        <Button onClick={handleCreate} disabled={newName.trim().length < 2}>
          <Plus /> <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Tags className="size-6" />
          </span>
          <p className="font-medium">Sin categorías</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea categorías para organizar tu catálogo.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || pending}
                  className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1 || pending}
                  className="text-muted-foreground enabled:hover:text-foreground disabled:opacity-30"
                  title="Bajar"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === c.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename(c.id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-9"
                    />
                    <Button size="icon" className="size-9" onClick={() => handleRename(c.id)}>
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditValue(c.name);
                      }}
                      className="group flex items-center gap-1.5 truncate text-left"
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {c.productCount}{" "}
                  {c.productCount === 1 ? "producto" : "productos"}
                  {!c.active && " · oculta"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Switch
                  checked={c.active}
                  onCheckedChange={(v) => handleToggle(c.id, v)}
                  aria-label="Activa"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-9 text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Eliminar “{c.name}”?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Los productos de esta categoría no se borran: quedan sin
                        categoría.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(c.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Guardando…
        </p>
      )}
    </div>
  );
}
