"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Country {
  code: string;
  flag: string;
  name: string;
  /** Largos válidos del número nacional (sin código de país ni el 0 inicial). */
  digits: number[];
  /** Con qué empiezan los celulares. Vacío = no se revisa el comienzo. */
  mobile?: string[];
}

/** Country dial codes — Venezuela first, then where Venezuelans commonly are. */
const COUNTRIES: Country[] = [
  { code: "58", flag: "🇻🇪", name: "Venezuela", digits: [10], mobile: ["412", "414", "416", "424", "426"] },
  { code: "1", flag: "🇺🇸", name: "EE.UU. / Canadá", digits: [10] },
  { code: "34", flag: "🇪🇸", name: "España", digits: [9], mobile: ["6", "7"] },
  { code: "57", flag: "🇨🇴", name: "Colombia", digits: [10], mobile: ["3"] },
  { code: "56", flag: "🇨🇱", name: "Chile", digits: [9], mobile: ["9"] },
  { code: "51", flag: "🇵🇪", name: "Perú", digits: [9], mobile: ["9"] },
  { code: "593", flag: "🇪🇨", name: "Ecuador", digits: [9], mobile: ["9"] },
  { code: "54", flag: "🇦🇷", name: "Argentina", digits: [10] },
  { code: "52", flag: "🇲🇽", name: "México", digits: [10] },
  { code: "507", flag: "🇵🇦", name: "Panamá", digits: [8] },
  { code: "55", flag: "🇧🇷", name: "Brasil", digits: [10, 11] },
  { code: "351", flag: "🇵🇹", name: "Portugal", digits: [9], mobile: ["9"] },
  { code: "39", flag: "🇮🇹", name: "Italia", digits: [9, 10] },
  { code: "44", flag: "🇬🇧", name: "Reino Unido", digits: [10] },
];

/** Códigos más largos primero: 593 tiene que ganarle a 59 y a 5. */
const BY_CODE_LENGTH = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);

/** El número nacional: sin separadores y sin el 0 de larga distancia. */
function national(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

/**
 * Si el cliente pega el número completo ("+54 11…", "0054 11…"), el país sale
 * de ahí y no de lo que quedó en el selector. Solo con "+" o "00": un "0412"
 * venezolano no puede cambiarle el país por su cuenta.
 */
function detectCountry(typed: string): Country | undefined {
  const t = typed.trim();
  if (!/^(\+|00)/.test(t)) return undefined;
  const digits = t.replace(/\D/g, "").replace(/^00/, "");
  return BY_CODE_LENGTH.find((c) => digits.startsWith(c.code));
}

/** "4121234567" → "412 123 4567", para que el cliente lo lea de un vistazo. */
function pretty(num: string): string {
  const groups: Record<number, number[]> = {
    8: [4, 4],
    9: [3, 3, 3],
    10: [3, 3, 4],
    11: [2, 5, 4],
  };
  const plan = groups[num.length];
  if (!plan) return num;
  const out: string[] = [];
  let i = 0;
  for (const size of plan) {
    out.push(num.slice(i, i + size));
    i += size;
  }
  return out.join(" ");
}

/**
 * Qué tiene de raro el número para el país elegido. Es un aviso, no un bloqueo:
 * el objetivo es que se note el prefijo equivocado antes de mandar el pedido —
 * ahí nace el mismo cliente cargado dos veces.
 */
function warningFor(country: Country, num: string): string | null {
  if (num.length < 6) return null;
  if (!country.digits.includes(num.length)) {
    const largos = country.digits.join(" o ");
    return `Un número de ${country.name} tiene ${largos} dígitos y escribiste ${num.length}. Revisa el prefijo del país.`;
  }
  if (country.mobile && !country.mobile.some((p) => num.startsWith(p))) {
    return `Los celulares de ${country.name} empiezan por ${country.mobile.join(", ")}. Revisa el prefijo del país.`;
  }
  return null;
}

interface PhoneInputProps {
  /** Emits the full international number as digits only (e.g. "584241234567"). */
  onChange: (value: string) => void;
  defaultCode?: string;
  placeholder?: string;
  /**
   * Número internacional ya guardado ("584241234567"), para reponer el campo.
   * Lo usa el borrador del checkout: si el cliente vuelve y ve el nombre y la
   * dirección puestos pero el teléfono vacío, cree que se perdió todo.
   */
  defaultValue?: string;
  /** Marca el campo como inválido para lectores de pantalla. */
  invalid?: boolean;
  /** Id del párrafo con el mensaje de error. */
  describedBy?: string;
}

/** Parte un número internacional en (código de país, número nacional). */
function splitInternational(value: string | undefined): {
  code: string;
  national: string;
} | null {
  const digits = (value ?? "").replace(/D/g, "");
  if (digits.length < 7) return null;
  const country = BY_CODE_LENGTH.find((c) => digits.startsWith(c.code));
  if (!country) return null;
  return { code: country.code, national: digits.slice(country.code.length) };
}

export function PhoneInput({
  onChange,
  defaultCode = "58",
  placeholder = "Número",
  defaultValue,
  invalid,
  describedBy,
}: PhoneInputProps) {
  const initial = splitInternational(defaultValue);
  const [code, setCode] = useState(initial?.code ?? defaultCode);
  const [number, setNumber] = useState(initial?.national ?? "");

  const country = COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
  const num = national(number);
  const warning = warningFor(country, num);

  function emit(c: string, n: string) {
    const nat = national(n);
    onChange(nat ? `${c}${nat}` : "");
  }

  function onType(typed: string) {
    const detected = detectCountry(typed);
    if (detected) {
      // Vino con código de país adentro: se lo saca al campo y se pone arriba.
      const rest = typed.replace(/\D/g, "").replace(/^00/, "").slice(detected.code.length);
      setCode(detected.code);
      setNumber(rest);
      emit(detected.code, rest);
      return;
    }
    setNumber(typed);
    emit(code, typed);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Select
          value={code}
          onValueChange={(c) => {
            setCode(c);
            emit(c, number);
          }}
        >
          <SelectTrigger className="w-[100px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.flag} +{c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          inputMode="tel"
          value={number}
          onChange={(e) => onType(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      </div>

      {num.length >= 6 &&
        (warning ? (
          <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {warning}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
            Se guarda como {country.flag} +{code} {pretty(num)}
          </p>
        ))}
    </div>
  );
}
