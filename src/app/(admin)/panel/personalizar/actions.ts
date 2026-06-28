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
  layout: z
    .enum(["classic", "fashion", "fashion-athletic", "fashion-streetwear", "accessories", "beauty", "beauty-minimal", "tech", "sports", "sports-drops"])
    .default("classic"),
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
  blocks: z
    .record(
      z.string().max(40),
      z.object({
        enabled: z.boolean(),
        title: z.string().max(80).default(""),
        subtitle: z.string().max(200).default(""),
      }),
    )
    .default({}),
  blockOrder: z.array(z.string().max(40)).max(30).default([]),
  media: z
    .object({
      heroSlides: z.array(z.string().max(400)).max(12).default([]),
      gallery: z.array(z.string().max(400)).max(12).default([]),
      pressLogos: z.array(z.string().max(400)).max(12).default([]),
    })
    .default({ heroSlides: [], gallery: [], pressLogos: [] }),
  testimonials: z
    .array(
      z.object({
        quote: z.string().max(400).default(""),
        author: z.string().max(80).default(""),
      }),
    )
    .max(12)
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string().max(80).default(""),
        address: z.string().max(200).default(""),
      }),
    )
    .max(20)
    .default([]),
  heroVideoUrl: z.string().max(400).default(""),
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
