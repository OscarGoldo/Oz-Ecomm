/**
 * Inserta un bloque JSON-LD en la página.
 *
 * Es el único `dangerouslySetInnerHTML` del proyecto y no hay alternativa: un
 * `<script type="application/ld+json">` necesita el JSON como texto crudo, y
 * React escaparía las comillas si se pasara como children.
 *
 * El escapado es obligatorio y no cosmético. El nombre y la descripción de un
 * producto los escribe el comerciante: sin esto, alguien que cargue un
 * producto llamado `</script><script>…` inyecta JavaScript en la página
 * pública de su propia tienda — y, peor, en cualquier página que embeba ese
 * dato. Se neutralizan los tres patrones que pueden cerrar el bloque:
 * `<`, `>` y `&`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
