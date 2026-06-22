"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import type { Json } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

const themeSchema = z.object({
  preset: z.string().max(40),
  colors: z.object({ primary: hex, accent: hex, surface: hex }),
  font: z.enum(["inter", "poppins", "montserrat", "lora"]),
  buttonStyle: z.enum(["rounded", "square"]),
  cardStyle: z.enum(["soft", "bordered"]),
  announcement: z.object({
    enabled: z.boolean(),
    text: z.string().max(140).default(""),
  }),
  hero: z.object({
    headline: z.string().max(140).default(""),
    subtext: z.string().max(240).default(""),
    ctaText: z.string().max(40).default(""),
  }),
  about: z.object({
    title: z.string().max(80).default(""),
    text: z.string().max(2000).default(""),
  }),
  sections: z.array(z.enum(["featured", "catalog", "about"])).max(10),
});

export type ThemeInput = z.input<typeof themeSchema>;

export async function updateStoreTheme(input: ThemeInput): Promise<ActionResult> {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const ctx = await getSessionContext();
  if (!ctx?.store) return { ok: false, error: "No autorizado" };

  const supabase = createClient();
  const { error } = await supabase
    .from("stores")
    .update({ customization: parsed.data as unknown as Json })
    .eq("id", ctx.store.id);
  if (error) return { ok: false, error: "No se pudieron guardar los cambios" };

  revalidatePath(`/${ctx.store.slug}`);
  revalidatePath("/panel/personalizar");
  return { ok: true };
}
