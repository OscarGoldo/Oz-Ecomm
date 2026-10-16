"use server";

import { DOMAIN_NOTICE_KEY } from "@/lib/domain-notice";
import { PLAN_GIFT_SEEN_KEY } from "@/lib/plan-gift";
import { STORE_ADDRESS_NOTICE_KEY } from "@/lib/store-address-notice";
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

/** Lo mismo para el aviso de la dirección propia (store-address-notice.ts). */
export async function dismissStoreAddressNotice(): Promise<void> {
  await createClient().auth.updateUser({
    data: { [STORE_ADDRESS_NOTICE_KEY]: new Date().toISOString() },
  });
}

/** Y para el aviso de los meses de Pro regalados (plan-gift.ts). */
export async function dismissPlanGiftNotice(): Promise<void> {
  await createClient().auth.updateUser({
    data: { [PLAN_GIFT_SEEN_KEY]: new Date().toISOString() },
  });
}
