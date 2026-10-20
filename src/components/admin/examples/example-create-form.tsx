"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createExample } from "@/app/(superadmin)/super/ejemplos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RUBROS, type RubroId } from "@/lib/design/bases";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

/**
 * Crear una página ejemplo: el nombre del negocio y su rubro alcanzan. El
 * enlace sale del nombre y se puede cambiar; lo demás se arma después, en la
 * página de la tienda.
 */
export function ExampleCreateForm({ platformHost }: { platformHost: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [rubro, setRubro] = useState<RubroId>("general");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [about, setAbout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finalSlug = slugTouched ? slugify(slug) : slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createExample({ name, slug: finalSlug, rubro, whatsapp, instagram, about });
    if (!res.ok || !res.id) {
      setBusy(false);
      setError(res.error ?? "No se pudo crear la página");
      return;
    }
    toast.success(`Página de ${name.trim()} creada`);
    router.push(`/super/ejemplos/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ex-name">Nombre del negocio</Label>
          <Input
            id="ex-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="iPhone Maturín"
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-slug">Enlace</Label>
          <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <Input
              id="ex-slug"
              value={slugTouched ? slug : finalSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="iphone-maturin"
              className="border-0 shadow-none focus-visible:ring-0"
              maxLength={80}
            />
            <span className="shrink-0 pr-3 font-mono text-xs text-muted-foreground">.{platformHost}</span>
          </div>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Rubro</legend>
        <p className="text-xs text-muted-foreground">Elige el que más se le parezca: define el diseño y los colores con que arranca.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {RUBROS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRubro(r.id)}
              aria-pressed={rubro === r.id}
              className={cn(
                "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                rubro === r.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ex-wa">WhatsApp (opcional)</Label>
          <Input
            id="ex-wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="0414-1234567"
            inputMode="tel"
          />
          <p className="text-xs text-muted-foreground">El del negocio, para que el botón de WhatsApp le escriba a él.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-ig">Instagram (opcional)</Label>
          <Input
            id="ex-ig"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@iphonematurin"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ex-about">¿Qué vende? (opcional)</Label>
        <Textarea
          id="ex-about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="iPhones nuevos y usados, forros, cargadores y audífonos. Entregas en Maturín."
          rows={2}
          maxLength={600}
        />
        <p className="text-xs text-muted-foreground">Con esto la IA arma el catálogo en el paso siguiente.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={busy || name.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />}
        Crear página ejemplo
      </Button>
    </form>
  );
}
