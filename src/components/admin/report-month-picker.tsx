"use client";

import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ReportMonthPicker({
  months,
  value,
}: {
  months: { ym: string; label: string }[];
  value: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Select
        value={value}
        onValueChange={(v) => router.push(`/panel/finanzas/reportes?m=${v}`)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.ym} value={m.ym}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Imprimir / PDF
      </Button>
    </div>
  );
}
