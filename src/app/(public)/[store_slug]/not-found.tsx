import Link from "next/link";
import { PackageSearch } from "lucide-react";

/**
 * 404 DENTRO de la tienda.
 *
 * El 404 global manda al cliente a la landing de Tiendify con el logo de la
 * plataforma: le sacábamos el cliente al comerciante y, en una tienda Pro —que
 * paga justamente por no mostrar la marca Tiendify— era una promesa incumplida.
 * Este vive dentro del layout de la tienda, así que conserva el header, el
 * footer y el botón de WhatsApp del comerciante.
 */
export default function StoreNotFound() {
  return (
    <main className="container grid min-h-[55vh] place-items-center py-12">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <PackageSearch className="size-7" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el producto ya no esté disponible o que el enlace esté
          incompleto.
        </p>
        <Link
          href="./"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ver el catálogo
        </Link>
      </div>
    </main>
  );
}
