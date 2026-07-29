/**
 * Quién es quién entre los pedidos. No hay cuenta de cliente: la identidad sale
 * del teléfono y del email que dejó en el checkout, así que dos pedidos son de
 * la misma persona si comparten cualquiera de los dos.
 */

/**
 * Dígitos finales del teléfono que se comparan. Deja afuera el código de país,
 * que es justo lo que cambia cuando el mismo cliente elige otro prefijo en el
 * selector (pasó de verdad: +58 y +54 sobre el mismo número). Nueve dígitos
 * alcanzan para el número nacional de los países del selector, y dos números
 * distintos de un mismo país no coinciden en esa cola.
 */
const PHONE_KEY_DIGITS = 9;

/** Identidad del teléfono, sin importar cómo se haya escrito. */
export function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-PHONE_KEY_DIGITS);
}

/** Identidad del email (es opcional en el checkout, puede faltar). */
export function emailKey(raw: string | null | undefined): string | null {
  return (raw ?? "").trim().toLowerCase() || null;
}

export interface CustomerFields {
  customer_phone: string;
  customer_email: string | null;
}

function keysOf(o: CustomerFields): string[] {
  const keys: string[] = [];
  const p = phoneKey(o.customer_phone);
  if (p) keys.push(`p:${p}`);
  const e = emailKey(o.customer_email);
  if (e) keys.push(`e:${e}`);
  return keys;
}

/**
 * Agrupa pedidos por cliente. Dos pedidos caen en el mismo grupo si comparten
 * teléfono o email, y la relación arrastra: si A y B comparten teléfono y B y C
 * comparten email, los tres son la misma persona. Sin esto, el mismo comprador
 * aparece repetido en /panel/clientes cada vez que escribe su número distinto.
 */
export function groupByCustomer<T extends CustomerFields>(orders: T[]): T[][] {
  const groups: T[][] = [];
  // key → grupo al que pertenece; varias keys pueden apuntar al mismo grupo.
  const index = new Map<string, T[]>();

  for (const o of orders) {
    const keys = keysOf(o);
    const hits = [...new Set(keys.map((k) => index.get(k)).filter(Boolean))] as T[][];

    let group: T[];
    if (hits.length === 0) {
      group = [];
      groups.push(group);
    } else {
      // Este pedido une grupos que hasta ahora parecían clientes distintos
      // (llegó con el teléfono de uno y el email de otro): se funden en el primero.
      group = hits[0]!;
      for (const other of hits.slice(1)) {
        group.push(...other);
        groups.splice(groups.indexOf(other), 1);
        for (const [k, g] of index) if (g === other) index.set(k, group);
      }
    }

    group.push(o);
    for (const k of keys) index.set(k, group);
    // Un pedido sin teléfono ni email usable queda solo en su grupo.
  }

  return groups;
}
