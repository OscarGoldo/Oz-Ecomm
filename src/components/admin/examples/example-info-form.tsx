"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateExampleInfo } from "@/app/(superadmin)/super/ejemplos/actions";
import { ExampleImageInput } from "@/components/admin/examples/example-image-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ExampleInfo {
  name: string;
  description: string;
  whatsapp: string;
  instagram: string;
  address: string;
  logo: string | null;
  banner: string | null;
}

/** Nombre, contacto, logo y foto de portada de la página ejemplo. */
export function ExampleInfoForm({ storeId, initial }: { storeId: string; initial: ExampleInfo }) {
  const router = useRouter();
  const [info, setInfo] = useState<ExampleInfo>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ExampleInfo>(key: K, value: ExampleInfo[K]) =>
    setInfo((i) => ({ ...i, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateExampleInfo(storeId, {
      name: info.name,
      description: info.description,
      whatsapp: info.whatsapp,
      instagram: info.instagram,
      address: info.address,
      logo_url: info.logo,
      banner_url: info.banner,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Datos guardados");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">El negocio</h2>
      <div className="space-y-1.5">
        <Label htmlFor="i-name">Nombre</Label>
        <Input id="i-name" value={info.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="i-desc">Descripción corta</Label>
        <Textarea
          id="i-desc"
          value={info.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          maxLength={600}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="i-wa">WhatsApp</Label>
          <Input id="i-wa" value={info.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" placeholder="0414-1234567" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="i-ig">Instagram</Label>
          <Input id="i-ig" value={info.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@negocio" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="i-addr">Ciudad o dirección</Label>
        <Input id="i-addr" value={info.address} onChange={(e) => set("address", e.target.value)} placeholder="Maturín, Monagas" maxLength={160} />
      </div>
      <ExampleImageInput
        storeId={storeId}
        folder="branding"
        value={info.logo}
        onChange={(v) => set("logo", v)}
        label="Logo"
      />
      <ExampleImageInput
        storeId={storeId}
        folder="branding"
        value={info.banner}
        onChange={(v) => set("banner", v)}
        stock="hero"
        shape="wide"
        label="Foto de portada"
      />
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        Guardar
      </Button>
    </form>
  );
}
