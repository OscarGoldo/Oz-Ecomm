// Service worker del panel de Tiendify. Hace UNA sola cosa: mostrar los avisos
// de pedidos que manda el servidor (src/lib/push.ts), aunque el navegador esté
// cerrado. El teléfono lo despierta un momento al llegar el aviso.
//
// A propósito no tiene handler de "fetch": no guarda nada en caché ni se mete
// en la navegación, así que el panel funciona exactamente igual que sin él.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Tiendify";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/tiendify-app-icon.png",
      tag: data.tag || undefined,
      // Con el mismo tag, el aviso nuevo reemplaza al anterior pero vuelve a sonar.
      renotify: Boolean(data.tag),
      data: { url: data.url || "/panel" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/panel",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      // Si el panel ya está abierto, se usa esa ventana en vez de abrir otra.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(`${self.location.origin}/panel`)) {
          try {
            await client.focus();
            await client.navigate(target);
            return;
          } catch {
            // Ventana que no controla este service worker: se abre una nueva.
          }
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
