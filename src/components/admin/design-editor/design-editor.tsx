"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronLeft,
  CircleHelp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  History,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutList,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  Monitor,
  Palette,
  PanelLeft,
  Plus,
  Quote,
  Redo2,
  Rows3,
  ShoppingBag,
  Smartphone,
  Tags,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { ProChip } from "@/components/admin/pro-lock";
import { Field, type FieldEnv } from "@/components/admin/design-editor/fields";
import { StylePanel } from "@/components/admin/design-editor/style-panel";
import {
  discardDesignDraft,
  listDesignVersions,
  publishStoreDesign,
  restoreDesignVersion,
  saveDesignDraft,
} from "@/app/(admin)/panel/personalizar/design-actions";
import {
  designStyle,
  proFeaturesUsed,
  sectionNeedsPro,
  switchLook,
  templateDesign,
} from "@/lib/design/design";
import { SECTION_DEFS, SECTION_TYPES, newSection, newSectionId } from "@/lib/design/sections";
import type { AnySection, LookId, SectionType, StoreDesign } from "@/lib/design/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  "badge-check": BadgeCheck,
  "shopping-bag": ShoppingBag,
  rows: Rows3,
  tags: Tags,
  "layout-grid": LayoutGrid,
  images: Images,
  award: Award,
  quote: Quote,
  "map-pin": MapPin,
  "book-open": BookOpen,
  "circle-help": CircleHelp,
  "panel-left": PanelLeft,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
};

/** Lo que se lee debajo del nombre de cada sección en la lista. */
function sectionSubtitle(s: AnySection): string {
  switch (s.type) {
    case "hero":
      return s.settings.headline || "Titular automático";
    case "benefits":
      return "Se arma con tus datos";
    case "collections":
      return "Una fila por categoría";
    default:
      return "title" in s.settings ? (s.settings as { title: string }).title : "";
  }
}

type SaveState = "idle" | "saving" | "saved" | "error";
type Panel = "secciones" | "estilo" | "agregar" | "historial";

export function DesignEditor({
  storeId,
  storeUrl,
  initialDesign,
  initialDirty,
  pro,
  categories,
}: {
  storeId: string;
  storeUrl: string;
  initialDesign: StoreDesign;
  /** Abre con un borrador sin publicar. */
  initialDirty: boolean;
  pro: boolean;
  categories: { slug: string; name: string }[];
}) {
  const [design, setDesign] = useState(initialDesign);
  const [dirty, setDirty] = useState(initialDirty);
  const [panel, setPanel] = useState<Panel>("secciones");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [mobileView, setMobileView] = useState<"editar" | "vista">("editar");
  const [confirm, setConfirm] = useState<null | { kind: "discard" } | { kind: "template"; look: LookId }>(null);
  const [versions, setVersions] = useState<{ id: string; created_at: string }[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Deshacer / rehacer. Las teclas seguidas en un mismo campo cuentan como un solo paso.
  const past = useRef<StoreDesign[]>([]);
  const future = useRef<StoreDesign[]>([]);
  const lastPush = useRef<{ at: number; key: string }>({ at: 0, key: "" });
  const [, bump] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveSeq = useRef(0);
  // Lo último que ya está en el servidor: no se vuelve a guardar lo mismo
  // (React en desarrollo corre los efectos dos veces al montar).
  const lastSaved = useRef<StoreDesign>(initialDesign);

  const env: FieldEnv = { storeId, pro, categories };
  const selected = design.home.find((s) => s.id === selectedId) ?? null;
  const proUsed = useMemo(() => (pro ? [] : proFeaturesUsed(design)), [design, pro]);

  const post = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ source: "tiendify-editor", ...msg }, window.location.origin);
  }, []);

  /** Todo cambio pasa por acá: guarda el paso para deshacer y marca borrador. */
  const change = useCallback(
    (next: StoreDesign, key = "") => {
      const now = Date.now();
      const coalesce = key && lastPush.current.key === key && now - lastPush.current.at < 800;
      if (!coalesce) {
        past.current = [...past.current.slice(-49), design];
        future.current = [];
      }
      lastPush.current = { at: now, key };
      setDesign(next);
      setDirty(true);
      bump((n) => n + 1);
    },
    [design],
  );

  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(design);
    lastPush.current = { at: 0, key: "" };
    setDesign(prev);
    setDirty(true);
    bump((n) => n + 1);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(design);
    setDesign(next);
    setDirty(true);
    bump((n) => n + 1);
  }

  // Autoguardado del borrador y, cuando termina, la vista previa se vuelve a dibujar.
  useEffect(() => {
    if (design === lastSaved.current) return;
    setSaveState("saving");
    const seq = ++saveSeq.current;
    const timer = setTimeout(async () => {
      const res = await saveDesignDraft(design);
      if (seq !== saveSeq.current) return;
      if (!res.ok) {
        setSaveState("error");
        toast.error(res.error);
        return;
      }
      lastSaved.current = design;
      setSaveState("saved");
      post({ type: "refresh" });
    }, 500);
    return () => clearTimeout(timer);
  }, [design, post]);

  // Colores y fuentes se ven al instante, sin esperar al servidor.
  useEffect(() => {
    post({ type: "style", vars: designStyle(design) as Record<string, string> });
  }, [design.tokens, design, post]);

  // Mensajes de la vista previa: lista para recibir, o una sección elegida con un clic.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const msg = e.data as { source?: string; type?: string; id?: string };
      if (msg?.source !== "tiendify-preview") return;
      if (msg.type === "ready" && selectedId) post({ type: "select", id: selectedId });
      if (msg.type === "select" && msg.id) {
        setSelectedId(msg.id);
        setPanel("secciones");
        setMobileView("editar");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, selectedId]);

  // Atajos de teclado: Ctrl+Z / Ctrl+Shift+Z.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function select(id: string | null) {
    setSelectedId(id);
    post({ type: "select", id });
  }

  // ─── Operaciones sobre secciones ─────────────────────────────────────────

  function setHome(home: AnySection[], key = "") {
    change({ ...design, home }, key);
  }
  function updateSettings(id: string, key: string, value: unknown) {
    setHome(
      design.home.map((s) => (s.id === id ? ({ ...s, settings: { ...s.settings, [key]: value } } as AnySection) : s)),
      `${id}:${key}`,
    );
  }
  function move(id: string, dir: -1 | 1) {
    const i = design.home.findIndex((s) => s.id === id);
    const t = i + dir;
    if (i < 0 || t < 0 || t >= design.home.length) return;
    const home = [...design.home];
    [home[i], home[t]] = [home[t]!, home[i]!];
    setHome(home);
  }
  function moveTo(id: string, targetId: string) {
    if (id === targetId) return;
    const home = design.home.filter((s) => s.id !== id);
    const moving = design.home.find((s) => s.id === id)!;
    const t = home.findIndex((s) => s.id === targetId);
    home.splice(t < 0 ? home.length : t, 0, moving);
    setHome(home);
  }
  function toggleHidden(id: string) {
    setHome(design.home.map((s) => (s.id === id ? ({ ...s, hidden: s.hidden ? undefined : true } as AnySection) : s)));
  }
  function duplicate(id: string) {
    const i = design.home.findIndex((s) => s.id === id);
    const copy = { ...design.home[i]!, id: newSectionId(), settings: structuredClone(design.home[i]!.settings) } as AnySection;
    const home = [...design.home];
    home.splice(i + 1, 0, copy);
    setHome(home);
    select(copy.id);
  }
  function remove(id: string) {
    setHome(design.home.filter((s) => s.id !== id));
    if (selectedId === id) select(null);
  }
  function add(type: SectionType) {
    const section = newSection(type) as AnySection;
    const i = selectedId ? design.home.findIndex((s) => s.id === selectedId) : -1;
    const home = [...design.home];
    home.splice(i >= 0 ? i + 1 : home.length, 0, section);
    setHome(home);
    setPanel("secciones");
    // La vista previa la espera: aparece cuando termina de guardarse el borrador.
    select(section.id);
  }

  // ─── Publicar, descartar, historial ─────────────────────────────────────

  async function publish() {
    setPublishing(true);
    const res = await publishStoreDesign(design);
    setPublishing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDirty(false);
    toast.success("¡Diseño publicado!", { description: "Tus clientes ya ven la tienda nueva." });
  }

  async function discard() {
    const res = await discardDesignDraft();
    if (!res.ok || !res.design) {
      toast.error(res.ok ? "No se pudo descartar" : res.error);
      return;
    }
    lastSaved.current = res.design;
    past.current = [];
    future.current = [];
    setDesign(res.design);
    setDirty(false);
    setSelectedId(null);
    post({ type: "refresh" });
    toast.success("Volviste a lo publicado");
  }

  async function openHistory() {
    setPanel("historial");
    setVersions(null);
    setVersions(await listDesignVersions());
  }

  async function restore(id: string) {
    const res = await restoreDesignVersion(id);
    if (!res.ok || !res.design) {
      toast.error(res.ok ? "No se pudo restaurar" : res.error);
      return;
    }
    change(res.design);
    setPanel("secciones");
    toast.success("Versión restaurada como borrador", { description: "Revísala y publica cuando quieras." });
  }

  // ─── Vista ──────────────────────────────────────────────────────────────

  const status =
    saveState === "saving"
      ? "Guardando…"
      : saveState === "error"
        ? "No se pudo guardar"
        : dirty
          ? "Borrador guardado · sin publicar"
          : "Publicado";

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de arriba */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diseño de tu tienda</h1>
          <p className={cn("flex items-center gap-1.5 text-sm", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>
            {saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : !dirty && <Check className="size-3.5" />}
            {status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border">
            <button type="button" onClick={undo} disabled={!past.current.length} className="p-2 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30" aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
              <Undo2 className="size-4" />
            </button>
            <button type="button" onClick={redo} disabled={!future.current.length} className="border-l p-2 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
              <Redo2 className="size-4" />
            </button>
          </div>
          <div className="hidden rounded-lg border lg:flex">
            <button type="button" onClick={() => setDevice("mobile")} className={cn("p-2", device === "mobile" ? "text-primary" : "text-muted-foreground")} aria-label="Ver en teléfono" title="Teléfono">
              <Smartphone className="size-4" />
            </button>
            <button type="button" onClick={() => setDevice("desktop")} className={cn("border-l p-2", device === "desktop" ? "text-primary" : "text-muted-foreground")} aria-label="Ver en computadora" title="Computadora">
              <Monitor className="size-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={openHistory}>
            <History className="size-4" /> Historial
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={storeUrl} target="_blank" rel="noopener noreferrer">
              Ver tienda <ExternalLink className="size-4" />
            </Link>
          </Button>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "discard" })}>
              Descartar
            </Button>
          )}
          <Button size="sm" onClick={publish} disabled={publishing || !dirty || saveState === "saving"}>
            {publishing ? <Loader2 className="animate-spin" /> : <Check />} Publicar
          </Button>
        </div>
      </div>

      {proUsed.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span>
            Estás usando {proUsed.join(", ")}: puedes probarlo acá, pero para publicarlo necesitas Pro.
          </span>
          <Link href="/panel/plan" className="font-medium text-primary hover:underline">
            Ver Pro
          </Link>
        </div>
      )}

      {/* En el teléfono se edita o se mira, una cosa a la vez */}
      <div className="flex rounded-lg border p-1 lg:hidden">
        {(["editar", "vista"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setMobileView(v)}
            className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", mobileView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {v === "editar" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[360px_1fr]">
        {/* Panel izquierdo */}
        <div className={cn("flex min-h-0 flex-col rounded-2xl border bg-card", mobileView === "vista" && "hidden lg:flex")}>
          {(panel === "secciones" || panel === "estilo") && !selected && (
            <div className="flex border-b p-1">
              {(
                [
                  ["secciones", "Secciones", LayoutList],
                  ["estilo", "Estilo", Palette],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanel(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium",
                    panel === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "estilo" && !selected && (
              <StylePanel
                design={design}
                pro={pro}
                onTokens={(patch) => change({ ...design, tokens: { ...design.tokens, ...patch } }, `tokens:${Object.keys(patch).join()}`)}
                onLook={(look) => change(switchLook(design, look))}
                onTemplate={(look) => setConfirm({ kind: "template", look })}
                onAnnouncement={(patch) =>
                  change(
                    { ...design, header: { announcement: { ...design.header.announcement, ...patch } } },
                    `ann:${Object.keys(patch).join()}`,
                  )
                }
              />
            )}

            {panel === "secciones" && !selected && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Toca una sección para editarla, o tócala en la vista previa. Arrástralas para cambiar el orden.
                </p>
                {design.home.map((s, i) => {
                  const def = SECTION_DEFS[s.type];
                  const Icon = ICONS[def.icon] ?? LayoutGrid;
                  const needsPro = !pro && sectionNeedsPro(s);
                  return (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dragId && moveTo(dragId, s.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "group flex items-center gap-2 rounded-xl border bg-background p-2 transition-colors",
                        dragId === s.id && "opacity-40",
                        s.hidden && "opacity-60",
                      )}
                    >
                      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/60" />
                      <button type="button" onClick={() => select(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-sm font-medium">
                            {def.label} {needsPro && <ProChip />}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{sectionSubtitle(s) || " "}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center">
                        <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0} className="p-1 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30 lg:hidden" aria-label="Subir">
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => move(s.id, 1)} disabled={i === design.home.length - 1} className="p-1 text-muted-foreground enabled:hover:text-foreground disabled:opacity-30 lg:hidden" aria-label="Bajar">
                          <ArrowDown className="size-3.5" />
                        </button>
                        {!def.required && (
                          <button type="button" onClick={() => toggleHidden(s.id)} className="p-1 text-muted-foreground hover:text-foreground" aria-label={s.hidden ? "Mostrar" : "Ocultar"} title={s.hidden ? "Mostrar" : "Ocultar"}>
                            {s.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" className="w-full" onClick={() => setPanel("agregar")}>
                  <Plus className="size-4" /> Agregar sección
                </Button>
              </div>
            )}

            {panel === "secciones" && selected && (
              <SectionSettings
                section={selected}
                env={env}
                pro={pro}
                onBack={() => select(null)}
                onChange={(key, value) => updateSettings(selected.id, key, value)}
                onToggleHidden={() => toggleHidden(selected.id)}
                onDuplicate={() => duplicate(selected.id)}
                onRemove={() => remove(selected.id)}
                onMove={(dir) => move(selected.id, dir)}
              />
            )}

            {panel === "agregar" && (
              <div className="space-y-3">
                <button type="button" onClick={() => setPanel("secciones")} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="size-4" /> Volver
                </button>
                <p className="text-sm font-semibold">Agregar una sección</p>
                <div className="grid gap-2">
                  {SECTION_TYPES.map((type) => {
                    const def = SECTION_DEFS[type];
                    const Icon = ICONS[def.icon] ?? LayoutGrid;
                    const taken = def.single && design.home.some((s) => s.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        disabled={taken}
                        onClick={() => add(type)}
                        className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors enabled:hover:border-primary/40 disabled:opacity-50"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {def.label} {def.pro && !pro && <ProChip />}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {taken ? "Ya está en tu página." : def.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {panel === "historial" && (
              <div className="space-y-3">
                <button type="button" onClick={() => setPanel("secciones")} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="size-4" /> Volver
                </button>
                <p className="text-sm font-semibold">Publicaciones anteriores</p>
                <p className="text-xs text-muted-foreground">
                  Restaurar una versión la trae como borrador: la revisas y la publicas cuando quieras.
                </p>
                {versions === null ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : versions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no publicaste con el editor nuevo.</p>
                ) : (
                  versions.map((v, i) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                      <span className="text-sm">
                        {new Date(v.created_at).toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" })}
                        {i === 0 && <span className="ml-1.5 text-xs text-muted-foreground">(la actual)</span>}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => restore(v.id)}>
                        Restaurar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vista previa: la tienda de verdad con el borrador */}
        <div className={cn("min-h-[70dvh] overflow-hidden rounded-2xl border bg-muted/40 lg:min-h-0", mobileView === "editar" && "hidden lg:block")}>
          <div className={cn("mx-auto h-full transition-[max-width] duration-300", device === "mobile" ? "max-w-[400px] lg:py-4" : "max-w-none")}>
            <iframe
              ref={iframeRef}
              src="/vista-previa"
              title="Vista previa de la tienda"
              className={cn("h-[70dvh] w-full bg-background lg:h-full", device === "mobile" && "lg:rounded-2xl lg:border lg:shadow-sm")}
            />
          </div>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "discard" ? "¿Descartar los cambios?" : "¿Empezar de cero con esta plantilla?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "discard"
                ? "Vuelves a lo que está publicado. Lo que cambiaste desde entonces se pierde."
                : "Tus secciones se reemplazan por las de la plantilla. Puedes deshacerlo con el botón de deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm?.kind === "discard") void discard();
                if (confirm?.kind === "template") {
                  const tpl = templateDesign(confirm.look);
                  change({ ...tpl, tokens: { ...tpl.tokens, colors: design.tokens.colors } });
                  setSelectedId(null);
                }
                setConfirm(null);
              }}
            >
              {confirm?.kind === "discard" ? "Descartar" : "Usar la plantilla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionSettings({
  section,
  env,
  pro,
  onBack,
  onChange,
  onToggleHidden,
  onDuplicate,
  onRemove,
  onMove,
}: {
  section: AnySection;
  env: FieldEnv;
  pro: boolean;
  onBack: () => void;
  onChange: (key: string, value: unknown) => void;
  onToggleHidden: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const def = SECTION_DEFS[section.type];
  const settings = section.settings as Record<string, unknown>;
  const fields = def.fields.filter((f) => !f.when || f.when(settings));

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Todas las secciones
      </button>
      <div>
        <p className="flex items-center gap-1.5 text-base font-semibold">
          {def.label} {!pro && sectionNeedsPro(section) && <ProChip />}
        </p>
        <p className="text-xs text-muted-foreground">{def.description}</p>
      </div>

      {fields.length ? (
        <div className="space-y-4">
          {fields.map((f) => (
            <Field key={f.key} field={f} value={settings[f.key]} onChange={(v) => onChange(f.key, v)} env={env} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          Esta sección se arma sola con los datos de tu tienda.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={() => onMove(-1)}>
          <ArrowUp className="size-4" /> Subir
        </Button>
        <Button variant="outline" size="sm" onClick={() => onMove(1)}>
          <ArrowDown className="size-4" /> Bajar
        </Button>
        {!def.required && (
          <Button variant="outline" size="sm" onClick={onToggleHidden}>
            {section.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {section.hidden ? "Mostrar" : "Ocultar"}
          </Button>
        )}
        {!def.single && (
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            <Copy className="size-4" /> Duplicar
          </Button>
        )}
        {!def.required && (
          <Button variant="outline" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Quitar
          </Button>
        )}
      </div>
    </div>
  );
}
