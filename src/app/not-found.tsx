import Link from "next/link";
import { Store } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4">
      <div className="text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </span>
        <p className="text-5xl font-bold tracking-tight">404</p>
        <p className="mt-2 text-muted-foreground">
          No encontramos lo que buscabas.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
