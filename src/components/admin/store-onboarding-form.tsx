"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createStore } from "@/app/(superadmin)/super/actions";
import { slugify } from "@/lib/slug";

interface FormValues {
  store_name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  primary_color: string;
  whatsapp: string;
}

export function StoreOnboardingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      store_name: "",
      slug: "",
      owner_name: "",
      owner_email: "",
      primary_color: "#2563EB",
      whatsapp: "",
    },
  });

  const storeName = watch("store_name");
  const slugField = watch("slug");
  const color = watch("primary_color");
  const previewSlug = slugify(slugField || storeName) || "mi-tienda";

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await createStore({
      store_name: values.store_name,
      slug: values.slug || undefined,
      owner_name: values.owner_name,
      owner_email: values.owner_email,
      primary_color: values.primary_color,
      whatsapp: values.whatsapp || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Tienda creada", {
      description: `El dueño puede entrar en /login con su email.`,
    });
    router.push("/super");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store_name">Nombre de la tienda *</Label>
            <Input
              id="store_name"
              {...register("store_name", { required: "Pon un nombre" })}
              placeholder="Ej. Tienda Bella"
            />
            {errors.store_name && (
              <p className="text-xs text-destructive">{errors.store_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Enlace (slug)</Label>
            <Input id="slug" {...register("slug")} placeholder="se genera del nombre" />
            <p className="text-xs text-muted-foreground">
              URL pública: <span className="font-medium text-foreground">/{previewSlug}</span>
            </p>
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
              <Input {...register("primary_color")} className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>WhatsApp (opcional)</Label>
            <PhoneInput onChange={(v) => setValue("whatsapp", v)} placeholder="424 1234567" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dueño de la tienda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="owner_name">Nombre del dueño *</Label>
            <Input
              id="owner_name"
              {...register("owner_name", { required: "Pon el nombre del dueño" })}
              placeholder="Ej. Ana García"
            />
            {errors.owner_name && (
              <p className="text-xs text-destructive">{errors.owner_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner_email">Email del dueño *</Label>
            <Input
              id="owner_email"
              type="email"
              {...register("owner_email", { required: "Pon el email" })}
              placeholder="dueno@correo.com"
            />
            {errors.owner_email && (
              <p className="text-xs text-destructive">{errors.owner_email.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Con este email el dueño entra al panel (magic link en /login).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? <Loader2 className="animate-spin" /> : <Rocket />}
          Crear tienda
        </Button>
      </div>
    </form>
  );
}
