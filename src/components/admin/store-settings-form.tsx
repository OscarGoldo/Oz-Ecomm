"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandingImageUpload } from "@/components/admin/branding-image-upload";
import {
  updateStoreSettings,
  type StoreSettingsInput,
} from "@/app/(admin)/panel/configuracion/actions";
import { cn } from "@/lib/utils";
import type { RateSource, Store } from "@/types/database";

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
  usdt_rate: string;
  rate_source: RateSource;
}

export interface BcvDisplay {
  usd: number | null;
  eur: number | null;
  paralelo: number | null;
  updated_at: string | null;
}

export function StoreSettingsForm({
  store,
  bcvRates,
}: {
  store: Store;
  bcvRates: BcvDisplay | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [logo, setLogo] = useState<string | null>(store.logo_url);
  const [banner, setBanner] = useState<string | null>(store.banner_url);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
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
      usdt_rate: store.usdt_rate != null ? String(store.usdt_rate) : "",
      rate_source: store.rate_source ?? (store.auto_exchange_rate ? "bcv" : "manual"),
    },
  });

  const color = watch("primary_color");
  const showBs = watch("show_bs_prices");
  const rateSource = watch("rate_source");

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
      rate_source: values.rate_source,
      usdt_rate: values.usdt_rate === "" ? null : values.usdt_rate,
      exchange_rate:
        values.rate_source === "bcv"
          ? bcvRates?.usd != null
            ? String(bcvRates.usd)
            : values.exchange_rate || null
          : values.exchange_rate === ""
            ? null
            : values.exchange_rate,
    };
    const res = await updateStoreSettings(input);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Cambios guardados");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div>
              <Label className="mb-2 block">Logo</Label>
              <BrandingImageUpload
                storeId={store.id}
                value={logo}
                onChange={setLogo}
                folder="logo"
                aspect="square"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la tienda *</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Poné un nombre" })}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color principal</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2563EB"}
                    onChange={(e) => setValue("primary_color", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border bg-background"
                    aria-label="Color"
                  />
                  <Input
                    id="color"
                    {...register("primary_color")}
                    className="font-mono"
                  />
                </div>
                {errors.primary_color && (
                  <p className="text-xs text-destructive">
                    {errors.primary_color.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={2}
              placeholder="Una frase que describa tu tienda…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Banner</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandingImageUpload
            storeId={store.id}
            value={banner}
            onChange={setBanner}
            folder="banner"
            aspect="wide"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacto y redes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              {...register("whatsapp")}
              placeholder="584241234567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" {...register("phone")} placeholder="0424-1234567" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              {...register("instagram")}
              placeholder="@tutienda"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="Ciudad, estado…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moneda y tasa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Mostrar precios en Bs</p>
              <p className="text-xs text-muted-foreground">
                Muestra el equivalente en bolívares en la tienda.
              </p>
            </div>
            <Switch
              checked={showBs}
              onCheckedChange={(v) => setValue("show_bs_prices", v)}
            />
          </div>

          {/* Which rate converts prices */}
          <div className="space-y-2">
            <Label>¿Con qué tasa se calculan los Bs?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "bcv", label: "BCV", sub: "Automática" },
                  { id: "usdt", label: "USDT", sub: "Binance" },
                  { id: "manual", label: "Manual", sub: "Tú la pones" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setValue("rate_source", o.id)}
                  className={cn(
                    "rounded-lg border p-2.5 text-center transition-colors",
                    rateSource === o.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-[11px] text-muted-foreground">{o.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {rateSource === "bcv" && (
            <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              Tu tienda usa el <strong>BCV oficial</strong>
              {bcvRates?.usd ? ` (Bs ${bcvRates.usd.toFixed(2)})` : ""} y se
              actualiza solo cada mañana.
            </p>
          )}

          {rateSource === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="exchange_rate">Tasa manual (Bs por USD)</Label>
              <Input
                id="exchange_rate"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register("exchange_rate")}
                placeholder="Ej. 95.00"
              />
            </div>
          )}

          {/* USDT rate (always editable: used for prices if selected, shown as reference) */}
          <div className="space-y-2">
            <Label htmlFor="usdt_rate">Tasa USDT / Binance (Bs por USDT)</Label>
            <Input
              id="usdt_rate"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register("usdt_rate")}
              placeholder="Ej. 110.00"
            />
            <p className="text-xs text-muted-foreground">
              {rateSource === "usdt"
                ? "Se usa para calcular los Bs de tu tienda."
                : "Se muestra de referencia en el resumen. Actualízala cuando cambie."}
            </p>
          </div>

          {/* Reference rates (today) */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Tasas de hoy (referencia)</p>
              {bcvRates?.updated_at && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(bcvRates.updated_at), "d MMM, HH:mm", { locale: es })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-background p-2.5">
                <p className="text-xs text-muted-foreground">BCV 🇻🇪</p>
                <p className="font-semibold">
                  {bcvRates?.usd ? `Bs ${bcvRates.usd.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-2.5">
                <p className="text-xs text-muted-foreground">Paralelo</p>
                <p className="font-semibold">
                  {bcvRates?.paralelo ? `Bs ${bcvRates.paralelo.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
