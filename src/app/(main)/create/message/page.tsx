import { Suspense } from "react";
import { MessageScreen } from "@/features/prototype/MaumCardScreens";

export default function CreateMessagePage() {
  return (
    <Suspense fallback={null}>
      <MessageScreen />
    </Suspense>
  );
}
