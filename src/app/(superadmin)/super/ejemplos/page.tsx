import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Presentation, Store as StoreIcon } from "lucide-react";

import { ExampleCreateForm } from "@/components/admin/examples/example-create-form";
import { requireSuperAdmin } from "@/lib/auth";
import { getImageUrl } from "@/lib/storage";
import { displayStoreAddress, platformHost, storeUrl } from "@/lib/store-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Páginas ejemplo" };

/**
 * Páginas ejemplo: la tienda que se le arma a un negocio antes de ir a
 * venderle, para decirle "mira, tu tienda se puede ver así". Sin cuenta ni
 * dueño: se crea, se edita y se borra desde acá (ver lib/example-pages.ts).
 */
export default async function SuperEjemplosPage() {
  await requireSuperAdmin();
  const db = createAdminClient();

  const { data: rows, error } = await db
    .from("stores")
    .select("id, slug, name, logo_url, banner_url, created_at, demo, example")
    .eq("demo", true)
    .order("created_at", { ascending: false });

  const examples = (rows ?? []).filter((s) => s.example);
  const testStores = (rows ?? []).filter((s) => !s.example);

  const ids = examples.map((s) => s.id);
  const { data: productRows } = ids.length
    ? await db.from("products").select("store_id").in("store_id", ids)
    : { data: [] };
  const productCount = new Map<string, number>();
  for (const p of productRows ?? []) productCount.set(p.store_id, (productCount.get(p.store_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Páginas ejemplo</h1>
        <p className="text-sm text-muted-foreground">
          Arma la tienda de un negocio antes de ir a venderle: con su nombre, sus productos y su link, sin crearle una cuenta.
          Cuando termines, la borras.
        </p>
      </div>

      {error ? (
        // Las columnas `demo` y `example` las crea la migración 0038.
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Todavía no se pueden crear páginas ejemplo: falta correr la migración{" "}
          <code className="font-mono text-xs">0038_example_pages.sql</code> en Supabase.
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Nueva página ejemplo</h2>
            <ExampleCreateForm platformHost={platformHost()} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Tus páginas</h2>
            {examples.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed bg-card p-10 text-center">
                <Presentation className="mb-3 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Todavía no armaste ninguna</p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {examples.map((s) => {
                  const logo = getImageUrl(s.logo_url);
                  const banner = getImageUrl(s.banner_url);
                  const n = productCount.get(s.id) ?? 0;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/super/ejemplos/${s.id}`}
                        className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-[16/7] bg-muted">
                          {banner && (
                            <Image src={banner} alt="" fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 p-3">
                          <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background">
                            {logo ? (
                              <Image src={logo} alt="" fill sizes="40px" className="object-contain p-0.5" />
                            ) : (
                              <StoreIcon className="size-4 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{s.name}</span>
                            <span className="block truncate font-mono text-xs text-muted-foreground">
                              {displayStoreAddress(storeUrl(s))}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {n} {n === 1 ? "producto" : "productos"} ·{" "}
                              {formatDistanceToNow(new Date(s.created_at), { locale: es, addSuffix: true })}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {testStores.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Tiendas de prueba</h2>
              <p className="text-sm text-muted-foreground">
                Las de los socios: no cuentan en los números de /super ni en el crédito. Funcionan como cualquier tienda.
              </p>
              <ul className="flex flex-wrap gap-2">
                {testStores.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/super/tiendas/${s.id}`}
                      className="inline-flex h-9 items-center rounded-full border bg-card px-3 text-sm hover:bg-muted"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
