"use server";

import { DOMAIN_NOTICE_KEY } from "@/lib/domain-notice";
import { createClient } from "@/lib/supabase/server";

/**
 * Marca el aviso del cambio de dominio como visto. Si falla no se le dice nada
 * al comerciante: lo peor que pasa es que el aviso le vuelva a salir.
 */
export async function dismissDomainNotice(): Promise<void> {
  await createClient().auth.updateUser({
    data: { [DOMAIN_NOTICE_KEY]: new Date().toISOString() },
  });
}
