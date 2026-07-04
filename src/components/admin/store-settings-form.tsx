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
      auto_exchange_rate: store.auto_exchange_rate ?? false,
    },
  });

  const color = watch("primary_color");
  const showBs = watch("show_bs_prices");
  const autoRate = watch("auto_exchange_rate");

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
                  {...register("name", { required: "Pon un nombre" })}
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
          <div className="space-y-2">
            <Label htmlFor="exchange_rate">Tasa del día (Bs por USD)</Label>
            <Input
              id="exchange_rate"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...register("exchange_rate")}
              placeholder="Ej. 95.00"
            />
            <p className="text-xs text-muted-foreground">
              Se usa para calcular los Bs en tu tienda.
            </p>
          </div>

          {/* BCV rates */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Tasa oficial BCV</p>
              {bcvRates?.updated_at && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(bcvRates.updated_at), "d MMM, HH:mm", { locale: es })}
                </span>
              )}
            </div>
            {bcvRates && (bcvRates.usd || bcvRates.eur) ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!bcvRates.usd}
                  onClick={() => bcvRates.usd && setValue("exchange_rate", String(bcvRates.usd))}
                  className="rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary disabled:opacity-50"
                >
                  <p className="text-xs text-muted-foreground">Dólar 🇺🇸</p>
                  <p className="font-semibold">{bcvRates.usd ? `Bs ${Number(bcvRates.usd).toFixed(2)}` : "—"}</p>
                  <p className="text-[11px] font-medium text-primary">Usar esta tasa</p>
                </button>
                <button
                  type="button"
                  disabled={!bcvRates.eur}
                  onClick={() => bcvRates.eur && setValue("exchange_rate", String(bcvRates.eur))}
                  className="rounded-lg border bg-background p-2.5 text-left transition-colors hover:border-primary disabled:opacity-50"
                >
                  <p className="text-xs text-muted-foreground">Euro 🇪🇺</p>
                  <p className="font-semibold">{bcvRates.eur ? `Bs ${Number(bcvRates.eur).toFixed(2)}` : "—"}</p>
                  <p className="text-[11px] font-medium text-primary">Usar esta tasa</p>
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Todavía no hay datos del BCV (se actualizan cada mañana).
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Actualizar con el BCV automáticamente</p>
              <p className="text-xs text-muted-foreground">
                Cada día a las 8:00 am tu tasa se pone igual a la del BCV.
              </p>
            </div>
            <Switch
              checked={autoRate}
              onCheckedChange={(v) => setValue("auto_exchange_rate", v)}
            />
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
