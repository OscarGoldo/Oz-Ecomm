"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { CheckCircle2, ExternalLink, Loader2, Mail, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpStore } from "@/app/(public)/crear-tienda/actions";
import { slugify } from "@/lib/slug";

interface FormValues {
  store_name: string;
  owner_name: string;
  owner_email: string;
  whatsapp: string;
  primary_color: string;
}

interface Success {
  slug: string;
  email: string;
  storeName: string;
  emailSent: boolean;
}

export function SignupForm({ prefillEmail = "" }: { prefillEmail?: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Success | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      store_name: "",
      owner_name: "",
      owner_email: prefillEmail,
      whatsapp: "",
      primary_color: "#2563EB",
    },
  });

  const storeName = watch("store_name");
  const color = watch("primary_color");
  const previewSlug = slugify(storeName) || "mi-tienda";

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await signUpStore({
      store_name: values.store_name,
      owner_name: values.owner_name,
      owner_email: values.owner_email,
      whatsapp: values.whatsapp || undefined,
      primary_color: values.primary_color || undefined,
    });
    setSubmitting(false);
    if (!res.ok || !res.slug) {
      toast.error(res.error ?? "No se pudo crear la tienda");
      return;
    }
    setDone({
      slug: res.slug,
      email: values.owner_email,
      storeName: values.store_name,
      emailSent: Boolean(res.emailSent),
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="text-xl font-bold tracking-tight">
          ¡{done.storeName} está lista! 🎉
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu tienda ya está en línea en:
        </p>
        <Link
          href={`/${done.slug}`}
          className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          /{done.slug} <ExternalLink className="size-3.5" />
        </Link>

        {done.emailSent && (
          <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-left text-sm">
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Te enviamos un enlace de acceso a{" "}
              <span className="font-medium text-foreground">{done.email}</span>.
              Abrilo para entrar a tu panel y cargar tus productos.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href={`/${done.slug}`}>Ver mi tienda</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/login">Ir a mi panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-2xl border bg-card p-6 sm:p-8"
    >
      <div className="space-y-2">
        <Label htmlFor="store_name">Nombre de tu tienda *</Label>
        <Input
          id="store_name"
          {...register("store_name", { required: "Poné un nombre" })}
          placeholder="Ej. Tienda Bella"
        />
        {errors.store_name ? (
          <p className="text-xs text-destructive">{errors.store_name.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tu link: <span className="font-medium text-foreground">/{previewSlug}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="owner_name">Tu nombre *</Label>
        <Input
          id="owner_name"
          {...register("owner_name", { required: "Ingresá tu nombre" })}
          placeholder="Ej. Ana García"
        />
        {errors.owner_name && (
          <p className="text-xs text-destructive">{errors.owner_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="owner_email">Tu email *</Label>
        <Input
          id="owner_email"
          type="email"
          inputMode="email"
          {...register("owner_email", { required: "Ingresá tu email" })}
          placeholder="tu@correo.com"
        />
        {errors.owner_email && (
          <p className="text-xs text-destructive">{errors.owner_email.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Con este email entrás a tu panel (sin contraseña, te llega un enlace).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" {...register("whatsapp")} placeholder="0424…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
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
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <Rocket />}
        Crear mi tienda gratis
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Sin tarjeta. Empezás a vender hoy.
      </p>
    </form>
  );
}
