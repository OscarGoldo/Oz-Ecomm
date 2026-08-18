import Link from "next/link";
import { ChevronDown } from "lucide-react";

/**
 * "Ver más productos" del catálogo.
 *
 * Es un link con `?ver=N`, no un botón con estado: funciona sin JavaScript, el
 * navegador conserva la posición al volver atrás y cada tramo se sirve desde el
 * server. En un Android lento eso se siente mejor que un scroll infinito que
 * pelea con el hilo principal.
 */
export function LoadMore({
  storeSlug,
  shown,
  step,
  searchParams,
}: {
  storeSlug: string;
  shown: number;
  step: number;
  searchParams: { q?: string; cat?: string };
}) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.cat) params.set("cat", searchParams.cat);
  params.set("ver", String(shown + step));

  return (
    <div className="container flex justify-center py-8">
      <Link
        href={`/${storeSlug}?${params.toString()}#catalogo`}
        prefetch={false}
        className="inline-flex h-12 items-center gap-2 rounded-xl border-2 px-6 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
      >
        Ver más productos <ChevronDown className="size-4" />
      </Link>
    </div>
  );
}
