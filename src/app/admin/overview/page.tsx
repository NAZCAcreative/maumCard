import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  CreditCard,
  FileText,
  ImageIcon,
  MessageSquareText,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/adminAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BottomNav from "@/components/layout/BottomNav";

async function safeCount(table: string, filters?: Array<[string, string, unknown]>) {
  let query = supabaseAdmin.from(table as never).select("id", { count: "exact", head: true });
  for (const [column, operator, value] of filters ?? []) {
    if (operator === "eq") query = query.eq(column as never, value as never);
    if (operator === "gte") query = query.gte(column as never, value as never);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");
  if (!isAdminUser(user)) notFound();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    profileCount,
    backgroundCount,
    activeBackgroundCount,
    homeCardCount,
    activeHomeCardCount,
    anniversaryCount,
    activeAnniversaryCount,
    promptTemplateCount,
    activePromptTemplateCount,
    phraseCount,
    activePhraseCount,
    logCount7d,
    settingsResult,
  ] = await Promise.all([
    safeCount("profiles"),
    safeCount("backgrounds"),
    safeCount("backgrounds", [["is_active", "eq", true]]),
    safeCount("home_featured_cards"),
    safeCount("home_featured_cards", [["is_active", "eq", true]]),
    safeCount("common_anniversaries"),
    safeCount("common_anniversaries", [["is_active", "eq", true]]),
    safeCount("card_prompt_templates"),
    safeCount("card_prompt_templates", [["is_active", "eq", true]]),
    safeCount("curated_phrases"),
    safeCount("curated_phrases", [["is_active", "eq", true]]),
    safeCount("generation_logs", [["created_at", "gte", sevenDaysAgo.toISOString()]]),
    supabaseAdmin
      .from("system_settings")
      .select("signup_bonus_credits, ai_suggestions_enabled, announcement_enabled, announcement_title")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  const stats = [
    { label: "프로필", value: profileCount, icon: <Users size={18} /> },
    { label: "배경", value: `${activeBackgroundCount}/${backgroundCount}`, icon: <ImageIcon size={18} /> },
    { label: "홈 카드", value: `${activeHomeCardCount}/${homeCardCount}`, icon: <Sparkles size={18} /> },
    { label: "기념일", value: `${activeAnniversaryCount}/${anniversaryCount}`, icon: <CalendarDays size={18} /> },
    { label: "프롬프트", value: `${activePromptTemplateCount}/${promptTemplateCount}`, icon: <FileText size={18} /> },
    { label: "문구", value: `${activePhraseCount}/${phraseCount}`, icon: <MessageSquareText size={18} /> },
    { label: "7일 로그", value: logCount7d, icon: <ScrollText size={18} /> },
    { label: "가입 보너스", value: `${settingsResult.data?.signup_bonus_credits ?? 3}C`, icon: <CreditCard size={18} /> },
  ];

  return (
    <>
      <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6">
        <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-5">
          <Link href="/admin" className="grid size-9 place-items-center rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-[#5a240d]">운영요약</h1>
            <p className="mt-0.5 text-xs font-semibold text-stone-500">관리 지표를 한 화면에서 봅니다.</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl bg-stone-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-white text-[#7b310d] shadow-sm">
                  {item.icon}
                </div>
                <span className="text-xs font-bold text-stone-400">{item.label}</span>
              </div>
              <div className="mt-4 text-2xl font-black text-stone-900">{String(item.value)}</div>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm font-semibold leading-6 text-stone-600 shadow-sm">
          공지 배너는 <span className="font-black text-stone-900">{settingsResult.data?.announcement_enabled ? "활성" : "비활성"}</span> 상태입니다.
          {settingsResult.data?.announcement_title ? (
            <>
              {" "}
              제목은 <span className="font-black text-stone-900">{settingsResult.data.announcement_title}</span>입니다.
            </>
          ) : null}
        </section>
      </main>
      <BottomNav />
    </>
  );
}
