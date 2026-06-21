"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function HeroSignup() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = email.trim();
    router.push(term ? `/crear-tienda?email=${encodeURIComponent(term)}` : "/crear-tienda");
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <input
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@correo.com"
        className="h-12 flex-1 rounded-xl border border-input bg-background px-4 text-base outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Crear tienda gratis <ArrowRight className="size-4" />
      </button>
    </form>
  );
}
