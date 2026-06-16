import { redirect } from "next/navigation";

// 목적(Purpose) 화면 제거 — 카드 만들기는 배경 선택부터 시작.
export default function CreatePage() {
  redirect("/create/background");
}
