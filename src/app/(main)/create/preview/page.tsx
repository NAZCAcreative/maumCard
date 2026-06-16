import { Suspense } from "react";
import { PreviewScreen } from "@/features/prototype/MaumCardScreens";

export default function CreatePreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewScreen />
    </Suspense>
  );
}
