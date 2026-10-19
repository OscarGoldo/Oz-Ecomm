"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Check, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BrandingImageUpload } from "@/components/admin/branding-image-upload";
import {
  updateStoreSettings,
  type StoreSettingsInput,
} from "@/app/(admin)/panel/configuracion/actions";
import { bcvDateLabel } from "@/lib/exchange-rate";
import { formatBs, formatUSD } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { Store } from "@/types/database";

interface FormValues {
  name: string;
  description: string;
  primary_color: string;
  whatsapp: string;
  instagram: string;
  phone: string;
  email: string;
  address: string;
  show_bs_prices: boolean;
  exchange_rate: string;
  auto_exchange_rate: boolean;
}

export interface BcvDisplay {
  usd: number | null;
  eur: number | null;
  /** Fecha valor: desde qué día rige, que es lo que muestra la web del BCV. */
  value_date: string | null;
}

/** Colores a mano; el selector de abajo deja elegir cualquiera. */
const SWATCHES = [
  { hex: "#0284C7", name: "Azul" },
  { hex: "#0B1B2B", name: "Noche" },
  { hex: "#B8476E", name: "Fucsia" },
  { hex: "#EB6834", name: "Naranja" },
  { hex: "#11755A", name: "Verde" },
  { hex: "#6250D6", name: "Violeta" },
  { hex: "#A16207", name: "Mostaza" },
  { hex: "#45576B", name: "Pizarra" },
];

const DESCRIPTION_HINT = 160;
const SAMPLE_PRICE = 10;

function validHex(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "T") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Los datos de la tienda: identidad, contacto y tasa. A la derecha, cómo la
 * ve el cliente con lo que se está escribiendo; la barra de guardar aparece
 * apenas se cambia algo.
 *
 * `after` va debajo de las secciones (avisos, cerrar tienda) y `aside` debajo
 * de la vista previa (la lista de "lista para vender"): son del servidor.
 */
export function StoreSettingsForm({
  store,
  bcvRates,
  after,
  aside,
}: {
  store: Store;
  bcvRates: BcvDisplay | null;
  after?: ReactNode;
  aside?: ReactNode;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [logo, setLogo] = useState<string | null>(store.logo_url);
  const [banner, setBanner] = useState<string | null>(store.banner_url);

  const defaults: FormValues = {
    name: store.name,
    description: store.description ?? "",
    primary_color: store.primary_color || "#2563EB",
    whatsapp: store.whatsapp ?? "",
    instagram: store.instagram ?? "",
    phone: store.phone ?? "",
    email: store.email ?? "",
    address: store.address ?? "",
    show_bs_prices: store.show_bs_prices,
    exchange_rate: store.exchange_rate != null ? String(store.exchange_rate) : "",
    auto_exchange_rate: store.auto_exchange_rate ?? false,
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: defaults });

  const name = watch("name");
  const description = watch("description");
  const color = watch("primary_color");
  const showBs = watch("show_bs_prices");
  const autoRate = watch("auto_exchange_rate");
  const rate = watch("exchange_rate");
  const dirty = isDirty || logo !== store.logo_url || banner !== store.banner_url;
  const shownColor = validHex(color) ? color : "#2563EB";

  /**
   * El comerciante escribió su propia tasa y por eso apagamos el automático.
   * Sin esto la tasa que escribe se la pisa el cron del BCV en su próxima
   * pasada y no hay nada que se lo explique: ve su número, guarda, y al rato
   * está el del BCV.
   */
  const [autoOffPorEdicion, setAutoOffPorEdicion] = useState(false);

  /** Campo de la tasa: hay que envolver el onChange de react-hook-form. */
  const { onChange: onRateChange, ...rateField } = register("exchange_rate");

  /** Poner una tasa a mano y dejar el automático encendido se contradicen. */
  function handleRateTyped(e: React.ChangeEvent<HTMLInputElement>) {
    onRateChange(e);
    if (autoRate) {
      setValue("auto_exchange_rate", false, { shouldDirty: true });
      setAutoOffPorEdicion(true);
    }
  }

  /** La del BCV, al día: se prende el automático y se pone la de hoy. */
  function pickBcvDaily() {
    setValue("auto_exchange_rate", true, { shouldDirty: true });
    setAutoOffPorEdicion(false);
    // Dos decimales: es lo que se muestra. El valor crudo del BCV trae cuatro.
    if (bcvRates?.usd) setValue("exchange_rate", Number(bcvRates.usd).toFixed(2), { shouldDirty: true });
  }

  function pickOwnRate() {
    setValue("auto_exchange_rate", false, { shouldDirty: true });
  }

  /** Copiar una tasa del BCV a "mi tasa" (por ejemplo, la del euro). */
  function aplicarTasaBcv(value: number) {
    setValue("exchange_rate", value.toFixed(2), { shouldDirty: true });
  }

  function discard() {
    reset(defaults);
    setLogo(store.logo_url);
    setBanner(store.banner_url);
    setAutoOffPorEdicion(false);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const input: StoreSettingsInput = {
      name: values.name,
      description: values.description || null,
      primary_color: values.primary_color,
      logo_url: logo,
      banner_url: banner,
      whatsapp: values.whatsapp || null,
      instagram: values.instagram || null,
      phone: values.phone || null,
      email: values.email || "",
      address: values.address || null,
      show_bs_prices: values.show_bs_prices,
      exchange_rate: values.exchange_rate === "" ? null : values.exchange_rate,
      auto_exchange_rate: values.auto_exchange_rate,
    };
    const res = await updateStoreSettings(input);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Cambios guardados");
    // Lo guardado pasa a ser el punto de partida: la barra se va.
    reset(values);
    router.refresh();
  }

  const rateNumber = Number(rate);
  const logoUrl = getImageUrl(logo);
  const bannerUrl = getImageUrl(banner);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Section id="identidad" title="Identidad" lead="Lo primero que ve tu cliente al entrar.">
          <div className="flex flex-wrap items-start gap-5">
            <div>
              <Label className="mb-2 block">Logo</Label>
              <BrandingImageUpload storeId={store.id} value={logo} onChange={setLogo} folder="logo" aspect="square" />
            </div>
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la tienda</Label>
                <Input id="name" {...register("name", { required: "Pon un nombre" })} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color principal</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      onClick={() => setValue("primary_color", s.hex, { shouldDirty: true })}
                      aria-label={`Color ${s.name}`}
                      aria-pressed={shownColor.toLowerCase() === s.hex.toLowerCase()}
                      className={cn(
                        "size-[34px] rounded-full border-2 border-white shadow-[0_0_0_1px_hsl(var(--linea))] transition-shadow",
                        shownColor.toLowerCase() === s.hex.toLowerCase() && "shadow-[0_0_0_2px_hsl(var(--noche))]",
                      )}
                      style={{ background: s.hex }}
                    />
                  ))}
                  <span className="ml-1 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={shownColor}
                      onChange={(e) => setValue("primary_color", e.target.value, { shouldDirty: true })}
                      className="h-[34px] w-10 cursor-pointer rounded-lg border bg-background"
                      aria-label="Elegir otro color"
                    />
                    <Input id="color" {...register("primary_color")} className="h-[34px] w-[92px] px-2 font-landing-mono text-[13px]" />
                  </span>
                </div>
                {errors.primary_color && <p className="text-xs text-destructive">{errors.primary_color.message}</p>}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-baseline justify-between">
              Descripción
              <span
                className={cn(
                  "font-landing-mono text-xs font-medium text-ink-400",
                  description.length > DESCRIPTION_HINT && "text-[#92400E]",
                )}
              >
                {description.length}/{DESCRIPTION_HINT}
              </span>
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={2}
              placeholder="Una frase que diga qué vendes y por qué comprarte a ti…"
            />
            {description.length > DESCRIPTION_HINT && (
              <p className="text-xs text-[#92400E]">En el teléfono se corta: más corta se lee entera.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="block">Banner</Label>
            <div className="max-w-md">
              <BrandingImageUpload storeId={store.id} value={banner} onChange={setBanner} folder="banner" aspect="wide" />
            </div>
            <p className="text-xs text-ink-500">Una foto ancha: 1600 × 500 se ve bien en teléfono y computadora.</p>
          </div>
        </Section>

        <Section id="contacto" title="Contacto y redes" lead="Por aquí te llegan los pedidos y las preguntas.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" inputMode="tel" {...register("whatsapp")} placeholder="584241234567" />
              <p className="text-xs text-ink-500">Con el código del país, sin espacios ni “+”.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" {...register("instagram")} placeholder="@tutienda" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                Teléfono <span className="font-normal text-ink-400">(opcional)</span>
              </Label>
              <Input id="phone" inputMode="tel" {...register("phone")} placeholder="0424-1234567" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register("address")} placeholder="Ciudad, estado…" />
            </div>
          </div>
        </Section>

        <Section id="tasa" title="Moneda y tasa" lead="Tus precios van en dólares; la tasa decide cuánto se cobra en bolívares.">
          <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Qué tasa usar">
            <RateOption
              checked={autoRate}
              onSelect={pickBcvDaily}
              title="Tasa BCV del día"
              text={
                bcvRates?.usd ? (
                  <>
                    Hoy <b className="font-landing-mono text-foreground">{formatBs(Number(bcvRates.usd))}</b>
                    {bcvRates.value_date ? ` (del ${bcvDateLabel(bcvRates.value_date)})` : ""}. Se actualiza sola cuando el BCV publica.
                  </>
                ) : (
                  "Se pone igual a la del BCV apenas la publica, en la tarde."
                )
              }
            />
            <RateOption
              checked={!autoRate}
              onSelect={pickOwnRate}
              title="Mi propia tasa"
              text="La pones tú y queda fija hasta que la cambies."
            />
          </div>

          {!autoRate && (
            <div className="space-y-2">
              <Label htmlFor="exchange_rate">Bs por cada dólar</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="exchange_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  {...rateField}
                  onChange={handleRateTyped}
                  placeholder="Ej. 95.00"
                  className="w-40 font-landing-mono"
                />
                {bcvRates?.usd && (
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => aplicarTasaBcv(Number(bcvRates.usd))}>
                    Poner la del dólar BCV
                  </Button>
                )}
                {bcvRates?.eur && (
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => aplicarTasaBcv(Number(bcvRates.eur))}>
                    Poner la del euro BCV
                  </Button>
                )}
              </div>
              {autoOffPorEdicion && (
                <p className="flex items-start gap-1.5 text-xs text-[#92400E]">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Pusiste tu propia tasa, así que dejamos de actualizarla con el BCV. Si no, en la próxima
                  actualización se te pondría la del BCV.
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 pt-1">
            <Switch
              checked={showBs}
              onCheckedChange={(v) => setValue("show_bs_prices", v, { shouldDirty: true })}
              className="data-[state=checked]:bg-brand-600"
            />
            <span className="text-sm">Mostrar el precio en bolívares debajo del precio en dólares</span>
          </label>
        </Section>

        {after}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <section aria-labelledby="asi-te-ven" className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
          <h2 id="asi-te-ven" className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            Así te ven
          </h2>
          <div className="overflow-hidden rounded-[14px] border border-[#E7EFF7]">
            <div className="relative h-16" style={{ background: `${shownColor}22` }}>
              {bannerUrl && <Image src={bannerUrl} alt="" fill sizes="360px" className="object-cover" />}
            </div>
            <div className="-mt-6 flex flex-col gap-2 px-3.5 pb-3.5">
              <span
                className="relative grid size-12 place-items-center overflow-hidden rounded-[13px] border-[3px] border-white font-display text-lg font-extrabold text-white"
                style={{ background: shownColor }}
              >
                {logoUrl ? <Image src={logoUrl} alt="" fill sizes="48px" className="object-cover" /> : initialsOf(name)}
              </span>
              <b className="truncate font-display text-lg font-extrabold">{name || "Tu tienda"}</b>
              {description && <span className="line-clamp-3 text-[12.5px] leading-[1.45] text-ink-500">{description}</span>}
              <span className="flex flex-wrap gap-1.5">
                <span className="inline-flex h-[30px] items-center rounded-full px-3 text-[12.5px] font-bold text-white" style={{ background: shownColor }}>
                  Ver productos
                </span>
                <span className="inline-flex h-[30px] items-center rounded-full border px-3 text-[12.5px] font-semibold">WhatsApp</span>
              </span>
              <span className="font-landing-mono text-xs text-pizarra">
                Un producto de {formatUSD(SAMPLE_PRICE)}
                {showBs && rateNumber > 0 && <span className="text-ink-400"> · {formatBs(SAMPLE_PRICE * rateNumber)}</span>}
              </span>
            </div>
          </div>
        </section>
        {aside}
      </div>

      {dirty && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4 xl:col-span-2">
          <div className="flex items-center gap-3 rounded-2xl bg-noche py-3 pl-4 pr-3 text-white shadow-[0_16px_40px_-12px_rgba(11,27,43,0.5)] sm:pl-[18px]">
            <span className="size-2 shrink-0 rounded-full bg-sol" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm">Tienes cambios sin guardar</span>
            <button
              type="button"
              onClick={discard}
              disabled={submitting}
              className="h-10 shrink-0 rounded-[10px] border border-white/20 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-sol px-4 text-sm font-bold text-noche transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Guardar<span className="hidden sm:inline"> cambios</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-card p-5 sm:px-[22px]">
      <div>
        <h2 id={`${id}-t`} className="font-display text-lg font-extrabold tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-500">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function RateOption({
  checked,
  onSelect,
  title,
  text,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  text: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-[14px] border bg-card p-3.5 text-left transition-colors hover:border-[#C2CFDC]",
        checked && "border-brand-600 bg-[#F0F8FE] shadow-[inset_0_0_0_1px_#0284C7] hover:border-brand-600",
      )}
    >
      <span
        className={cn(
          "mt-px size-[18px] shrink-0 rounded-full border-2 border-niebla",
          checked && "border-[5px] border-brand-600",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <b className="block text-[14.5px]">{title}</b>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">{text}</span>
      </span>
    </button>
  );
}
