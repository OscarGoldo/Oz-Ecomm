/**
 * Las cuentas cortas de la calculadora de la tasa: "20", "12,50", "3×12,50",
 * "1.000+250". Suma, resta, multiplica y divide, con × y ÷ antes que + y −, sin
 * paréntesis. Devuelve null si el texto no es una cuenta (o divide por cero).
 *
 * Los números van como se escriben en Venezuela: la coma es el decimal y el
 * punto separa miles. Un punto sin coma cuenta como decimal, salvo que lo sigan
 * exactamente tres cifras: "1.000" son mil y "12.5" es doce y medio.
 */
export function evalAmount(text: string): number | null {
  const src = text
    .replace(/\s+/g, "")
    .replace(/[×xX]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  if (!src || !/^[\d.,+\-*/]+$/.test(src)) return null;

  const tokens = src.match(/\d[\d.,]*|[+\-*/]/g);
  if (!tokens || tokens.join("") !== src) return null;

  // Números y operadores alternados. Un operador suelto al final se ignora:
  // es lo que queda a medio escribir ("3×").
  const nums: number[] = [];
  const ops: string[] = [];
  for (const token of tokens) {
    const wantNumber = nums.length === ops.length;
    if (wantNumber) {
      const n = toNumber(token);
      if (n === null) return null;
      nums.push(n);
    } else {
      if (!/^[+\-*/]$/.test(token)) return null;
      ops.push(token);
    }
  }
  if (ops.length === nums.length) ops.pop();

  // Primero × y ÷, después + y −.
  const terms = [nums[0]];
  const adds: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const next = nums[i + 1];
    if (ops[i] === "*") terms[terms.length - 1] *= next;
    else if (ops[i] === "/") {
      if (next === 0) return null;
      terms[terms.length - 1] /= next;
    } else {
      adds.push(ops[i]);
      terms.push(next);
    }
  }
  let result = terms[0];
  adds.forEach((op, i) => {
    result = op === "+" ? result + terms[i + 1] : result - terms[i + 1];
  });
  return Number.isFinite(result) ? result : null;
}

function toNumber(token: string): number | null {
  let s = token;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
