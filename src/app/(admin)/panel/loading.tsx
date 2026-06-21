import { Loader2 } from "lucide-react";

export default function PanelLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
