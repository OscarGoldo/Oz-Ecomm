"use server";

import { revalidatePath } from "next/cache";

import {
  HIDDEN_TASKS_KEY,
  MAX_HIDDEN_IDS,
  TASK_IDS,
  readHiddenTasks,
  type TaskId,
} from "@/lib/dashboard-tasks";
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

/**
 * Oculta una tarea de "Para atender hoy" hasta que tenga algo nuevo (ver
 * dashboard-tasks.ts). Se guardan los ids que el comerciante tenía a la vista.
 */
export async function hideDashboardTask(taskId: string, itemIds: unknown): Promise<void> {
  if (!(TASK_IDS as readonly string[]).includes(taskId)) return;
  const ids = Array.isArray(itemIds)
    ? itemIds.filter((x): x is string => typeof x === "string" && x.length <= 64).slice(0, MAX_HIDDEN_IDS)
    : [];

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  // updateUser reemplaza la clave entera: se suma a lo que ya estaba oculto.
  const hidden = readHiddenTasks(data.user.user_metadata ?? {});
  await supabase.auth.updateUser({
    data: { [HIDDEN_TASKS_KEY]: { ...hidden, [taskId as TaskId]: ids } },
  });
  revalidatePath("/panel");
}

/** Vuelve a mostrar todas las tareas ocultas. */
export async function showHiddenTasks(): Promise<void> {
  await createClient().auth.updateUser({ data: { [HIDDEN_TASKS_KEY]: {} } });
  revalidatePath("/panel");
}
