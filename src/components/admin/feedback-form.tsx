"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import {
  sendFeedback,
  type FeedbackInput,
} from "@/app/(admin)/panel/comentarios/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_KINDS } from "@/lib/support";
import { cn } from "@/lib/utils";

type Kind = FeedbackInput["kind"];

/** Qué pedir según de qué va: un ejemplo orienta más que "escribe aquí". */
const PLACEHOLDER: Record<Kind, string> = {
  problem: "Qué estabas haciendo y qué pasó. Si viste un código de error, pégalo.",
  idea: "Qué te gustaría poder hacer y para qué lo usarías.",
  other: "Lo que quieras contarnos.",
};

export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("problem");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Cuéntanos un poco más");
      return;
    }
    setSending(true);
    const res = await sendFeedback({ kind, message });
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo enviar");
      return;
    }
    setMessage("");
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <div>
            <p className="font-semibold">Recibido, gracias</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo leemos nosotros mismos. Si hace falta, te escribimos a tu
              correo o a tu WhatsApp.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSent(false)}>
            Enviar otro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">¿De qué se trata?</Label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  aria-pressed={kind === k.id}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    kind === k.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/40",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-xs">
              Tu mensaje
            </Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError(null);
              }}
              rows={6}
              maxLength={4000}
              placeholder={PLACEHOLDER[kind]}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "feedback-error" : undefined}
            />
            {error && (
              <p id="feedback-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" disabled={sending} className="w-full sm:w-auto">
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
