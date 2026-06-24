import type { VariantOption } from "@/types/database";

/** Keep only axes that have a name and at least one value. */
export function cleanVariantOptions(options: VariantOption[]): VariantOption[] {
  return options
    .map((o) => ({
      name: o.name.trim(),
      values: o.values.map((v) => v.trim()).filter(Boolean),
    }))
    .filter((o) => o.name.length > 0 && o.values.length > 0);
}

/** Cartesian product of the axis values, e.g. [["S","Rojo"],["S","Azul"],…]. */
export function variantCombos(options: VariantOption[]): string[][] {
  const axes = cleanVariantOptions(options);
  if (axes.length === 0) return [];
  return axes.reduce<string[][]>(
    (acc, axis) => acc.flatMap((combo) => axis.values.map((v) => [...combo, v])),
    [[]],
  );
}

/** Display label for a combination: ["M","Rojo"] → "M / Rojo". */
export function variantLabel(values: string[]): string {
  return values.join(" / ");
}

/** Stable key for a combination (React keys / matching across edits). */
export function variantKey(values: string[]): string {
  return values.join("");
}

/** Whether two option-value arrays describe the same combination. */
export function sameVariant(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
