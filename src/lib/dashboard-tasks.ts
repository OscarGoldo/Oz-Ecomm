/**
 * Tareas de "Para atender hoy" que el comerciante ocultó.
 *
 * Se guardan en el user_metadata de su cuenta (como los avisos que ya cerró),
 * así que valen en el teléfono y en la computadora. Por cada tarea se guardan
 * los ids que había al ocultarla: vuelve sola apenas aparece uno nuevo (otro
 * carrito, otro comprobante, otro producto que se agota). Si solo bajan, sigue
 * oculta: eso ya lo vio.
 *
 * Archivo sin "use server": lo usan el Resumen (servidor) y la acción.
 */

export const HIDDEN_TASKS_KEY = "hidden_tasks";

export const TASK_IDS = ["comprobantes", "esperan-pago", "carritos", "stock"] as const;
export type TaskId = (typeof TASK_IDS)[number];

/** Tope de ids por tarea: el metadata de la cuenta no es una tabla. */
export const MAX_HIDDEN_IDS = 200;

export type HiddenTasks = Partial<Record<TaskId, string[]>>;

export function readHiddenTasks(metadata: Record<string, unknown>): HiddenTasks {
  const raw = metadata[HIDDEN_TASKS_KEY];
  if (!raw || typeof raw !== "object") return {};
  const out: HiddenTasks = {};
  for (const id of TASK_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (Array.isArray(v)) out[id] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/** ¿Sigue oculta? Solo si no apareció nada nuevo desde que la ocultó. */
export function isTaskHidden(hidden: HiddenTasks, id: TaskId, itemIds: string[]): boolean {
  const seen = hidden[id];
  if (!seen) return false;
  const set = new Set(seen);
  return itemIds.every((x) => set.has(x));
}
