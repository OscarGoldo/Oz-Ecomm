import type { ReactNode } from "react";

import { ConfigTabs } from "@/components/admin/config-tabs";
import { requireStoreUser } from "@/lib/auth";
import { getStoreSetup } from "@/lib/store-setup";

/** La cabecera de Ajustes y sus tres partes, iguales en Tienda, Pagos y Entrega. */
export default async function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const { store } = await requireStoreUser();
  const { summaries } = await getStoreSetup(store);

  return (
    <div className="space-y-5">
      <header>
        <p className="font-landing-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">Configuración</p>
        <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.05] tracking-[-0.028em]">Ajustes</h1>
        <p className="mt-1.5 text-[15px] text-ink-600">Cómo se ve tu tienda, cómo te contactan y cómo cobras.</p>
      </header>
      <ConfigTabs summaries={summaries} />
      {children}
    </div>
  );
}
