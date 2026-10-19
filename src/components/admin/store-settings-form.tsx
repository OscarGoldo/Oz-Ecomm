"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, type Path, type PathValue } from "react-hook-form";
import { Check, Info, Loader2, RefreshCw } from "lucide-react";
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
import {
  applyMargin,
  baseRate,
  bcvDateLabel,
  MARGIN_MAX,
  MARGIN_MIN,
  marginLabel,
  RATE_SOURCES,
  rateSettings,
  type RateInputs,
} from "@/lib/exchange-rate";
import { formatBs, formatUSD } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { ExchangeRateSource, Store } from "@/types/database";

/**
 * Qué tasa eligió, como se ve en pantalla: una de las tres automáticas tal
 * cual, o "propia", que puede ser una de ellas con un ajuste en % o un número
 * fijo. Al guardar se traduce a `auto_exchange_rate` + fuente + ajuste.
 */
type RateMode = ExchangeRateSource | "own";
type OwnKind = "linked" | "fixed";

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
  /** La tasa fija, cuando la pone el comerciante. */
  exchange_rate: string;
  rate_mode: RateMode;
  own_kind: OwnKind;
  /** La tasa de la que sale la propia atada. */
  own_source: ExchangeRateSource;
  /** El ajuste va en dos partes: el teclado decimal del teléfono no trae "−". */
  margin_sign: "+" | "-";
  margin_abs: string;
}

const SOURCE_ORDER: ExchangeRateSource[] = ["bcv_usd", "bcv_eur", "usdt"];

const COPY_LABEL: Record<ExchangeRateSource, string> = {
  bcv_usd: "Poner la del dólar BCV",
  bcv_eur: "Poner la del euro BCV",
  usdt: "Poner la del USDT",
};

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
  usdtRate,
  after,
  aside,
}: {
  store: Store;
  bcvRates: BcvDisplay | null;
  /** Bolívares por USDT ahora (lib/usdt.ts), o null si no respondió. */
  usdtRate: number | null;
  after?: ReactNode;
  aside?: ReactNode;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [logo, setLogo] = useState<string | null>(store.logo_url);
  const [banner, setBanner] = useState<string | null>(store.banner_url);

  const saved = rateSettings(store);
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
    rate_mode: saved.auto && saved.margin === 0 ? saved.source : "own",
    own_kind: saved.auto ? "linked" : "fixed",
    own_source: saved.source,
    margin_sign: saved.margin < 0 ? "-" : "+",
    margin_abs: saved.margin ? String(Math.abs(saved.margin)) : "",
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
  const rate = watch("exchange_rate");
  const mode = watch("rate_mode");
  const ownKind = watch("own_kind");
  const ownSource = watch("own_source");
  const marginSign = watch("margin_sign");
  const marginAbs = watch("margin_abs");
  const dirty = isDirty || logo !== store.logo_url || banner !== store.banner_url;
  const shownColor = validHex(color) ? color : "#2563EB";

  const inputs: RateInputs = {
    usd: bcvRates?.usd ?? null,
    eur: bcvRates?.eur ?? null,
    usdt: usdtRate,
  };
  const fixed = mode === "own" && ownKind === "fixed";
  const source: ExchangeRateSource = mode === "own" ? ownSource : mode;
  const marginNumber = Number(String(marginAbs).replace(",", ".")) || 0;
  const margin = mode === "own" && ownKind === "linked" ? (marginSign === "-" ? -marginNumber : marginNumber) : 0;
  const marginOk = margin >= MARGIN_MIN && margin <= MARGIN_MAX;
  const base = baseRate(source, inputs);
  /** La tasa que va a quedar al guardar, para la vista previa. */
  const previewRate = fixed ? Number(rate) || 0 : base != null && marginOk ? applyMargin(base, margin) : 0;

  function pick<K extends Path<FormValues>>(key: K, value: PathValue<FormValues, K>) {
    setValue(key, value, { shouldDirty: true });
  }

  /** Copiar una de las tasas del día a la fija, para partir de ahí. */
  function copyRate(value: number) {
    // Dos decimales: es lo que se muestra. El valor crudo del BCV trae cuatro.
    pick("exchange_rate", value.toFixed(2));
  }

  function discard() {
    reset(defaults);
    setLogo(store.logo_url);
    setBanner(store.banner_url);
  }

  async function onSubmit(values: FormValues) {
    if (!fixed && !marginOk) {
      toast.error(`El ajuste va de ${MARGIN_MIN} % a +${MARGIN_MAX} %`);
      return;
    }
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
      // La automática la calcula el servidor; solo la fija viaja como número.
      exchange_rate: fixed && values.exchange_rate !== "" ? values.exchange_rate : null,
      auto_exchange_rate: !fixed,
      exchange_rate_source: source,
      exchange_rate_margin: margin,
    };
    const res = await updateStoreSettings(input);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Cambios guardados", res.notice ? { description: res.notice } : undefined);
    // Lo guardado pasa a ser el punto de partida: la barra se va.
    reset(values);
    router.refresh();
  }

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
              checked={mode === "bcv_usd"}
              onSelect={() => pick("rate_mode", "bcv_usd")}
              title="Dólar BCV"
              text={
                inputs.usd ? (
                  <>
                    Hoy <b className="font-landing-mono text-foreground">{formatBs(inputs.usd)}</b>
                    {bcvRates?.value_date ? ` (del ${bcvDateLabel(bcvRates.value_date)})` : ""}. Se actualiza sola cuando el BCV publica.
                  </>
                ) : (
                  "Se pone igual a la del BCV apenas la publica, en la tarde."
                )
              }
            />
            <RateOption
              checked={mode === "bcv_eur"}
              onSelect={() => pick("rate_mode", "bcv_eur")}
              title="Euro BCV"
              text={
                <>
                  {inputs.eur && (
                    <>
                      Hoy <b className="font-landing-mono text-foreground">{formatBs(inputs.eur)}</b>.{" "}
                    </>
                  )}
                  Tus precios siguen en dólares y los Bs salen con la tasa del euro. Se actualiza sola.
                </>
              }
            />
            <RateOption
              checked={mode === "usdt"}
              onSelect={() => pick("rate_mode", "usdt")}
              title="USDT · Binance P2P"
              text={
                <>
                  {inputs.usdt && (
                    <>
                      Hoy <b className="font-landing-mono text-foreground">{formatBs(inputs.usdt)}</b>.{" "}
                    </>
                  )}
                  Se actualiza sola cada hora. Tus clientes ven «Tasa del día», sin decir de dónde sale.
                </>
              }
            />
            <RateOption
              checked={mode === "own"}
              onSelect={() => pick("rate_mode", "own")}
              title="Tasa propia"
              text="Una de estas más o menos un %, que se actualiza sola, o un número fijo que pones tú."
            />
          </div>

          {mode === "own" && (
            <div className="flex flex-col gap-4 rounded-[14px] border bg-ink-25 p-3.5 sm:p-4">
              <Segmented
                label="Cómo es tu tasa"
                value={ownKind}
                onChange={(v) => pick("own_kind", v)}
                options={[
                  { value: "linked", label: "Se actualiza sola" },
                  { value: "fixed", label: "Fija" },
                ]}
              />

              {ownKind === "linked" ? (
                <>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Parte de</p>
                    <Segmented
                      label="De qué tasa parte"
                      value={ownSource}
                      onChange={(v) => pick("own_source", v)}
                      options={SOURCE_ORDER.map((s) => ({ value: s, label: RATE_SOURCES[s].name }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="margin_abs">Ajuste</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented
                        label="Sumar o restar"
                        value={marginSign}
                        onChange={(v) => pick("margin_sign", v)}
                        options={[
                          { value: "+", label: "Más" },
                          { value: "-", label: "Menos" },
                        ]}
                      />
                      <span className="relative">
                        <Input
                          id="margin_abs"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          {...register("margin_abs")}
                          placeholder="0"
                          className="w-24 pr-8 font-landing-mono"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">%</span>
                      </span>
                    </div>
                  </div>
                  <p className="flex items-start gap-1.5 text-[13px] leading-snug text-ink-600">
                    <RefreshCw className="mt-0.5 size-3.5 shrink-0 text-brand-600" />
                    <span>
                      {!marginOk ? (
                        <span className="text-[#92400E]">
                          El ajuste va de {MARGIN_MIN} % a +{MARGIN_MAX} %.
                        </span>
                      ) : base == null ? (
                        `Todavía no hay dato del ${RATE_SOURCES[source].name}: tu tasa se pone sola apenas llegue.`
                      ) : (
                        <>
                          Hoy serían <b className="font-landing-mono text-foreground">{formatBs(previewRate)}</b>{" "}
                          ({RATE_SOURCES[source].name} {formatBs(base)}
                          {margin ? ` ${marginLabel(margin)}` : ""}).
                          Se actualiza sola {source === "usdt" ? "cada hora, con el USDT" : "cuando el BCV publica"}.
                        </>
                      )}
                    </span>
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="exchange_rate">Bs por cada dólar</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="exchange_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      {...register("exchange_rate")}
                      placeholder="Ej. 95.00"
                      className="w-40 font-landing-mono"
                    />
                    {SOURCE_ORDER.map((s) => {
                      const value = baseRate(s, inputs);
                      return (
                        value != null && (
                          <Button
                            key={s}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10"
                            onClick={() => copyRate(value)}
                          >
                            {COPY_LABEL[s]}
                          </Button>
                        )
                      );
                    })}
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-ink-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    No se actualiza sola: cámbiala cuando cambie. Si pasa una semana sin tocarla, te lo
                    recordamos en el Resumen.
                  </p>
                </div>
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
                {showBs && previewRate > 0 && <span className="text-ink-400"> · {formatBs(SAMPLE_PRICE * previewRate)}</span>}
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

/** Dos o tres opciones excluyentes en fila: el tipo de tasa propia, la base, el signo. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 self-start rounded-xl border bg-card p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-[9px] px-3 text-[13.5px] font-semibold transition-colors",
              on ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-25 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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
