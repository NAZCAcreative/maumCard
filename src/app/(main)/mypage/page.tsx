import { MyPageScreen } from "@/features/prototype/MaumCardScreens";
import { Suspense } from "react";

export default function MyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <MyPageScreen />
    </Suspense>
  );
}
