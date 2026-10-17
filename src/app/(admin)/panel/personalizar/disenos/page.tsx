import { redirect } from "next/navigation";

import { DesignGallery, type GalleryBase } from "@/components/admin/design-editor/design-gallery";
import { requireStoreUser } from "@/lib/auth";
import { BASES, baseNeedsPro, rubroForLook } from "@/lib/design/bases";
import { designV2Enabled } from "@/lib/design/flag";
import { designTablesReady, loadDraft } from "@/lib/design/store";
import { isPro } from "@/lib/plans";

export const metadata = { title: "Diseños" };

/** La vitrina de diseños base. Solo con el editor por secciones. */
export default async function DesignGalleryPage() {
  const { store } = await requireStoreUser();
  if (!designV2Enabled(store) || !(await designTablesReady())) redirect("/panel/personalizar");

  const { design } = await loadDraft(store);
  const bases: GalleryBase[] = BASES.map((b) => ({
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    pro: baseNeedsPro(b),
    palettes: b.palettes,
  }));

  return (
    <DesignGallery
      bases={bases}
      pro={isPro(store)}
      initialRubro={rubroForLook(design.tokens.look)}
      currentBase={design.tokens.base}
    />
  );
}
