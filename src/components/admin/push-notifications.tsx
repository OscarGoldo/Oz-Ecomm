"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Share, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/(admin)/panel/push-actions";
import { cn } from "@/lib/utils";

/**
 * Activar los avisos de pedidos en este teléfono (Web Push, ver src/lib/push.ts).
 *
 * Dos formas: `card` vive en Ajustes y muestra todo (activar, probar,
 * desactivar); `prompt` va en el Resumen, aparece solo mientras no estén
 * activos en este teléfono y se puede cerrar.
 */

type State =
  | "checking"
  | "unsupported"
  /** iPhone/iPad en Safari: primero hay que agregar el panel a la pantalla de inicio. */
  | "ios-install"
  | "denied"
  | "off"
  | "on";

const SW_URL = "/sw.js";
const SW_SCOPE = "/panel";
const PROMPT_DISMISSED_KEY = "tf_push_prompt_dismissed";
const SYNCED_KEY = "tf_push_synced";

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS se presenta como Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** La clave pública VAPID viene en base64url; el navegador la pide en bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function readFlag(storage: "local" | "session", key: string): boolean {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(storage: "local" | "session", key: string): void {
  try {
    (storage === "local" ? localStorage : sessionStorage).setItem(key, "1");
  } catch {
    // Modo privado o almacenamiento bloqueado: solo se pierde el recordatorio.
  }
}

export function PushNotifications({
  publicKey,
  variant,
}: {
  publicKey: string;
  variant: "card" | "prompt";
}) {
  const [state, setState] = useState<State>("checking");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (sub) {
          setEndpoint(sub.endpoint);
          setState("on");
          // Una vez por sesión se vuelve a guardar: si el servidor la perdió
          // (otra cuenta en este teléfono, la base se limpió), se recupera sola.
          if (!readFlag("session", SYNCED_KEY)) {
            writeFlag("session", SYNCED_KEY);
            void savePushSubscription(sub.toJSON(), navigator.userAgent);
          }
          return;
        }
        setState(Notification.permission === "denied" ? "denied" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    setDismissed(readFlag("local", PROMPT_DISMISSED_KEY));
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        if (permission === "denied") toast.error("Bloqueaste los avisos en este navegador.");
        return;
      }
      await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        toast.error(res.error ?? "No pudimos activar los avisos.");
        return;
      }
      writeFlag("session", SYNCED_KEY);
      setEndpoint(sub.endpoint);
      setState("on");
      toast.success("Listo: te avisamos aquí de cada pedido.", {
        action: { label: "Probar", onClick: () => void test(sub.endpoint) },
      });
    } catch {
      toast.error("Este navegador no dejó activar los avisos. Prueba con Chrome.");
    } finally {
      setWorking(false);
    }
  }

  async function test(target = endpoint) {
    if (!target) return;
    setWorking(true);
    const res = await sendTestPush(target);
    setWorking(false);
    if (res.ok) toast.success("Aviso enviado. Debería sonar en unos segundos.");
    else toast.error(res.error ?? "No pudimos mandar la prueba.");
  }

  async function deactivate() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      const target = sub?.endpoint ?? endpoint;
      await sub?.unsubscribe();
      if (target) await removePushSubscription(target);
      setEndpoint(null);
      setState("off");
      toast.success("Avisos desactivados en este teléfono.");
    } catch {
      toast.error("No pudimos desactivar los avisos. Intenta de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  function dismiss() {
    writeFlag("local", PROMPT_DISMISSED_KEY);
    setDismissed(true);
  }

  if (variant === "prompt") {
    // En el Resumen solo se ofrece lo que se puede hacer ya mismo.
    if (dismissed || (state !== "off" && state !== "ios-install")) return null;
    return (
      <section className="relative flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ahora no"
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary/10 text-primary">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <p className="font-semibold">Entérate de cada pedido al instante</p>
          {state === "ios-install" ? (
            <IosSteps />
          ) : (
            <p className="text-sm text-ink-600">
              Te suena el teléfono cuando entra un pedido o un comprobante, aunque tengas el
              navegador cerrado.
            </p>
          )}
        </div>
        {state === "off" && (
          <Button onClick={activate} disabled={working} className="shrink-0">
            {working ? <Loader2 className="animate-spin" /> : <Bell />} Activar avisos
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-[10px]",
            state === "on" ? "bg-success-surface text-success-text" : "bg-primary/10 text-primary",
          )}
        >
          {state === "on" ? <BellRing className="size-5" /> : state === "denied" ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Avisos de pedidos en este teléfono</h2>
          <CardBody state={state} />
        </div>
      </div>

      {(state === "off" || state === "on") && (
        <div className="mt-4 flex flex-wrap gap-2 sm:pl-[3.375rem]">
          {state === "off" ? (
            <Button onClick={activate} disabled={working}>
              {working ? <Loader2 className="animate-spin" /> : <Bell />} Activar avisos
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void test()} disabled={working}>
                {working ? <Loader2 className="animate-spin" /> : <Smartphone />} Mandar una prueba
              </Button>
              <Button variant="ghost" onClick={deactivate} disabled={working}>
                Desactivar
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function CardBody({ state }: { state: State }) {
  switch (state) {
    case "checking":
      return <p className="mt-1 text-sm text-ink-600">Revisando este navegador…</p>;
    case "on":
      return (
        <p className="mt-1 text-sm text-ink-600">
          Activos. Cuando entre un pedido o un comprobante, te suena aquí aunque tengas el
          navegador cerrado. Si alguien más atiende la tienda, que los active en su teléfono.
        </p>
      );
    case "off":
      return (
        <p className="mt-1 text-sm text-ink-600">
          Te suena el teléfono con cada pedido o comprobante nuevo, aunque tengas el navegador
          cerrado. Al tocar el aviso se abre el pedido. Es gratis y lo desactivas cuando quieras.
        </p>
      );
    case "ios-install":
      return <IosSteps />;
    case "denied":
      return (
        <p className="mt-1 text-sm text-ink-600">
          Los avisos están bloqueados en este navegador. Para activarlos, toca el candado o los
          tres puntos junto a la dirección, entra a Permisos o Configuración del sitio y permite
          las notificaciones. Después recarga esta página.
        </p>
      );
    case "unsupported":
      return (
        <p className="mt-1 text-sm text-ink-600">
          Este navegador no permite avisos. En Android, abre el panel en Chrome; en iPhone, en
          Safari, y agrégalo a la pantalla de inicio.
        </p>
      );
  }
}

function IosSteps() {
  return (
    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink-600">
      <li>
        En Safari, toca Compartir <Share className="inline size-3.5 align-[-2px]" /> y luego
        &quot;Agregar a inicio&quot;.
      </li>
      <li>Abre Tiendify desde el ícono nuevo de tu pantalla de inicio.</li>
      <li>Vuelve a esta sección y toca Activar avisos.</li>
    </ol>
  );
}
