/**
 * Seed: creates the first tenant "Alfa Electronic" with its owner, categories,
 * a catalog of products and payment methods. Idempotent — safe to re-run.
 *
 * Usage:  npm run seed
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Optional: SEED_OWNER_EMAIL (the email that can log into Alfa's panel).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../src/types/database";

// ── env ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL =
  process.env.SEED_OWNER_EMAIL ?? "ovalery1903@gmail.com";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STORE_SLUG = "alfa-electronic";
const ph = (text: string, bg = "1b3d8f") =>
  `https://placehold.co/600x450/${bg}/ffffff?text=${encodeURIComponent(text)}`;

// ── data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Refrigeración",
  "Cocina",
  "Lavado",
  "Climatización",
  "Pequeños electrodomésticos",
  "Audio y video",
  "Accesorios",
];

interface SeedProduct {
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  description: string;
  featured?: boolean;
  status?: "active" | "draft" | "archived";
  lowStockThreshold?: number;
}

const PRODUCTS: SeedProduct[] = [
  // Refrigeración
  {
    name: "Nevera Ejecutiva 14 pies",
    category: "Refrigeración",
    price: 520,
    compareAt: 580,
    stock: 6,
    featured: true,
    description:
      "Refrigerador de dos puertas, 14 pies cúbicos, bajo consumo. Congelador independiente y bandejas de vidrio templado.",
  },
  {
    name: "Congelador Horizontal 7 pies",
    category: "Refrigeración",
    price: 340,
    stock: 4,
    description:
      "Freezer horizontal de 7 pies, ideal para negocios. Termostato ajustable y canasta interna.",
  },
  {
    name: "Frigobar 3.2 pies",
    category: "Refrigeración",
    price: 145,
    stock: 9,
    description:
      "Mini nevera silenciosa para habitación u oficina. Puerta reversible y bandeja para latas.",
  },
  // Cocina
  {
    name: "Cocina a Gas 4 Hornillas",
    category: "Cocina",
    price: 260,
    stock: 5,
    featured: true,
    description:
      "Cocina de acero inoxidable con 4 hornillas, horno con luz y encendido eléctrico.",
  },
  {
    name: "Campana Extractora 60 cm",
    category: "Cocina",
    price: 110,
    stock: 7,
    description:
      "Extractor de olores de 60 cm con triple velocidad, filtros lavables e iluminación LED.",
  },
  {
    name: "Microondas Digital 20L",
    category: "Cocina",
    price: 95,
    stock: 12,
    description:
      "Horno microondas de 20 litros, panel digital, 10 niveles de potencia y función descongelado.",
  },
  // Lavado
  {
    name: "Lavadora Automática 13 kg",
    category: "Lavado",
    price: 410,
    compareAt: 460,
    stock: 4,
    featured: true,
    description:
      "Lavadora automática de carga superior, 13 kg, múltiples ciclos y tina de acero inoxidable.",
  },
  {
    name: "Lavadora Semiautomática 9 kg",
    category: "Lavado",
    price: 235,
    stock: 8,
    description:
      "Doble tina, lava y centrifuga. Ideal donde el servicio de agua es intermitente.",
  },
  {
    name: "Secadora Eléctrica 10 kg",
    category: "Lavado",
    price: 320,
    stock: 3,
    lowStockThreshold: 4,
    description:
      "Secadora de 10 kg con sensor de humedad y tambor de gran capacidad.",
  },
  // Climatización
  {
    name: "Aire Acondicionado Split 12.000 BTU",
    category: "Climatización",
    price: 380,
    stock: 6,
    featured: true,
    description:
      "Split inverter 12.000 BTU, bajo consumo, control remoto y modo silencioso. Frío potente para clima de Maturín.",
  },
  {
    name: "Ventilador de Pie 18 pulgadas",
    category: "Climatización",
    price: 45,
    stock: 20,
    description:
      "Ventilador de pie con 3 velocidades, altura ajustable y oscilación amplia.",
  },
  {
    name: "Ventilador de Techo 52 pulgadas",
    category: "Climatización",
    price: 70,
    stock: 10,
    description:
      "Ventilador de techo de 5 aspas con control de pared y kit de instalación incluido.",
  },
  // Pequeños electrodomésticos
  {
    name: "Air Fryer Digital 3.5L",
    category: "Pequeños electrodomésticos",
    price: 65,
    stock: 15,
    featured: true,
    description:
      "Freidora de aire digital de 3.5 litros, hasta 80% menos aceite. Pantalla táctil con 8 programas.",
  },
  {
    name: "Licuadora Alta Potencia 1000W",
    category: "Pequeños electrodomésticos",
    price: 55,
    stock: 14,
    description:
      "Licuadora de 1000W con vaso de vidrio templado 1.5L, 5 velocidades y función pulso.",
  },
  {
    name: "Olla Arrocera 1.8L",
    category: "Pequeños electrodomésticos",
    price: 38,
    stock: 18,
    description:
      "Olla arrocera de 1.8L (10 tazas) con función mantener caliente y recipiente antiadherente.",
  },
  {
    name: "Sandwichera Grill",
    category: "Pequeños electrodomésticos",
    price: 28,
    stock: 2,
    lowStockThreshold: 3,
    description:
      "Sandwichera con placas antiadherentes y luz indicadora. Lista en minutos.",
  },
  // Audio y video
  {
    name: 'Smart TV 43" Full HD',
    category: "Audio y video",
    price: 290,
    compareAt: 330,
    stock: 7,
    featured: true,
    description:
      'Televisor Smart de 43 pulgadas Full HD, con apps de streaming, WiFi y 3 entradas HDMI.',
  },
  {
    name: "Barra de Sonido 2.1 Bluetooth",
    category: "Audio y video",
    price: 85,
    stock: 9,
    description:
      "Barra de sonido con subwoofer inalámbrico, Bluetooth y entrada óptica.",
  },
  // Accesorios
  {
    name: "Protector de Voltaje 220V",
    category: "Accesorios",
    price: 22,
    stock: 30,
    description:
      "Protege neveras y aires de las subidas de tensión. Retardo de arranque automático.",
  },
  {
    name: "Estabilizador 1200 VA",
    category: "Accesorios",
    price: 40,
    stock: 0,
    status: "draft",
    description:
      "Estabilizador de voltaje 1200 VA (borrador, próximamente disponible).",
  },
];

const PAYMENT_METHODS: Array<
  Database["public"]["Tables"]["payment_methods"]["Insert"]
> = [
  {
    store_id: "",
    type: "pago_movil",
    label: "Pago Móvil",
    details: {
      banco: "Banco de Venezuela (0102)",
      telefono: "0424-1234567",
      cedula: "V-12.345.678",
      titular: "Alfa Electronic C.A.",
    } as Json,
    requires_proof: true,
    instructions: "Indicá el número de pedido en la referencia.",
    display_order: 1,
  },
  {
    store_id: "",
    type: "zelle",
    label: "Zelle",
    details: {
      email: "pagos@alfaelectronic.com",
      titular: "Alfa Electronic",
    } as Json,
    requires_proof: true,
    instructions: "Enviá la captura del envío al confirmar el pedido.",
    display_order: 2,
  },
  {
    store_id: "",
    type: "binance",
    label: "Binance Pay (USDT)",
    details: { email_o_id: "alfaelectronic@binance" } as Json,
    requires_proof: true,
    display_order: 3,
  },
  {
    store_id: "",
    type: "cash",
    label: "Efectivo (al retirar/entregar)",
    details: {} as Json,
    requires_proof: false,
    instructions: "Pagás en efectivo al recibir o retirar el pedido.",
    display_order: 4,
  },
];

// ── helpers ──────────────────────────────────────────────────────────────────
async function upsertStore(): Promise<string> {
  const { data, error } = await db
    .from("stores")
    .upsert(
      {
        slug: STORE_SLUG,
        name: "Alfa Electronic",
        description:
          "Electrodomésticos y electrónica en Maturín. Tu tienda de confianza.",
        primary_color: "#1b3d8f",
        whatsapp: "584241234567",
        instagram: "@alfaelectronic",
        phone: "0424-1234567",
        email: "hola@alfaelectronic.com",
        address: "Maturín, Estado Monagas, Venezuela",
        currency_primary: "USD",
        show_bs_prices: true,
        exchange_rate: 95,
        exchange_rate_updated_at: new Date().toISOString(),
        offers_delivery: true,
        delivery_note: "Delivery gratis dentro de Maturín.",
        offers_pickup: true,
        pickup_address: "Av. Bolívar, Maturín (retiro en tienda).",
        active: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("store upsert failed");
  return data.id;
}

async function ensureOwner(storeId: string): Promise<void> {
  // Reuse existing app user if present.
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .maybeSingle();

  let userId = existing?.id;

  if (!userId) {
    // Find or create the auth user.
    const created = await db.auth.admin.createUser({
      email: OWNER_EMAIL,
      email_confirm: true,
    });

    if (created.data.user) {
      userId = created.data.user.id;
    } else {
      // Likely already exists in auth — locate it.
      const list = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list.data.users.find(
        (u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase(),
      );
      if (!found) throw created.error ?? new Error("could not create owner");
      userId = found.id;
    }
  }

  const { error } = await db.from("users").upsert(
    {
      id: userId,
      store_id: storeId,
      full_name: "Dueño Alfa Electronic",
      email: OWNER_EMAIL,
      role: "store_owner",
      active: true,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function reseedCatalog(storeId: string): Promise<void> {
  // Clean slate for the catalog (orders are untouched / none exist yet).
  await db.from("products").delete().eq("store_id", storeId);
  await db.from("categories").delete().eq("store_id", storeId);
  await db.from("payment_methods").delete().eq("store_id", storeId);

  // Categories
  const categoryRows = CATEGORIES.map((name, i) => ({
    store_id: storeId,
    name,
    slug: slugify(name),
    display_order: i,
    active: true,
  }));
  const { data: cats, error: catErr } = await db
    .from("categories")
    .insert(categoryRows)
    .select("id, name");
  if (catErr || !cats) throw catErr ?? new Error("category insert failed");

  const catIdByName = new Map(cats.map((c) => [c.name, c.id]));

  // Products
  const productRows = PRODUCTS.map((p) => ({
    store_id: storeId,
    category_id: catIdByName.get(p.category) ?? null,
    name: p.name,
    slug: slugify(p.name),
    description: p.description,
    price: p.price,
    currency: "USD",
    compare_at_price: p.compareAt ?? null,
    stock: p.stock,
    track_stock: true,
    low_stock_threshold: p.lowStockThreshold ?? 5,
    status: p.status ?? "active",
    featured: p.featured ?? false,
    images: [ph(p.name)],
  }));
  const { error: prodErr } = await db.from("products").insert(productRows);
  if (prodErr) throw prodErr;

  // Payment methods
  const pmRows = PAYMENT_METHODS.map((m) => ({ ...m, store_id: storeId }));
  const { error: pmErr } = await db.from("payment_methods").insert(pmRows);
  if (pmErr) throw pmErr;
}

async function main() {
  console.log("→ Seeding Alfa Electronic…");
  const storeId = await upsertStore();
  console.log(`  store id: ${storeId}`);
  await ensureOwner(storeId);
  console.log(`  owner: ${OWNER_EMAIL}`);
  await reseedCatalog(storeId);
  console.log(
    `  ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ${PAYMENT_METHODS.length} payment methods`,
  );
  console.log("✓ Done. Log in at /login with the owner email.");
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
