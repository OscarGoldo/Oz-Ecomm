"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Country dial codes — Venezuela first, then where Venezuelans commonly are. */
const COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: "58", flag: "🇻🇪", name: "Venezuela" },
  { code: "1", flag: "🇺🇸", name: "EE.UU. / Canadá" },
  { code: "34", flag: "🇪🇸", name: "España" },
  { code: "57", flag: "🇨🇴", name: "Colombia" },
  { code: "56", flag: "🇨🇱", name: "Chile" },
  { code: "51", flag: "🇵🇪", name: "Perú" },
  { code: "593", flag: "🇪🇨", name: "Ecuador" },
  { code: "54", flag: "🇦🇷", name: "Argentina" },
  { code: "52", flag: "🇲🇽", name: "México" },
  { code: "507", flag: "🇵🇦", name: "Panamá" },
  { code: "55", flag: "🇧🇷", name: "Brasil" },
  { code: "351", flag: "🇵🇹", name: "Portugal" },
  { code: "39", flag: "🇮🇹", name: "Italia" },
  { code: "44", flag: "🇬🇧", name: "Reino Unido" },
];

interface PhoneInputProps {
  /** Emits the full international number as digits only (e.g. "584241234567"). */
  onChange: (value: string) => void;
  defaultCode?: string;
  placeholder?: string;
}

export function PhoneInput({
  onChange,
  defaultCode = "58",
  placeholder = "Número",
}: PhoneInputProps) {
  const [code, setCode] = useState(defaultCode);
  const [number, setNumber] = useState("");

  function emit(c: string, n: string) {
    // strip non-digits, then drop the local trunk "0" (e.g. VE 0424 → 424)
    const national = n.replace(/\D/g, "").replace(/^0+/, "");
    onChange(national ? `${c}${national}` : "");
  }

  return (
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
        onChange={(e) => {
          setNumber(e.target.value);
          emit(code, e.target.value);
        }}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  );
}
