import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  ImageIcon,
  MessageSquareText,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { canManageAdminRoles, isAdminUser } from "@/lib/adminAccess";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BottomNav from "@/components/layout/BottomNav";

type StatCard = {
  label: string;
  value: string;
  description: string;
  icon: ReactNode;
};

type MenuItem = {
  href: string;
  title: string;
  desc: string;
  icon: ReactNode;
  tone: string;
};

type MenuGroup = {
  title: string;
  description: string;
  items: MenuItem[];
};

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

export default async function AdminPage() {
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

  const announcementTitle = settingsResult.data?.announcement_title?.trim();

  const stats: StatCard[] = [
    {
      label: "프로필",
      value: profileCount.toLocaleString(),
      description: "현재 가입된 사용자 프로필",
      icon: <Users size={18} />,
    },
    {
      label: "배경",
      value: `${activeBackgroundCount}/${backgroundCount}`,
      description: "활성 배경 / 전체 배경",
      icon: <ImageIcon size={18} />,
    },
    {
      label: "메인 카드",
      value: `${activeHomeCardCount}/${homeCardCount}`,
      description: "활성 홈 카드 / 전체 홈 카드",
      icon: <Sparkles size={18} />,
    },
    {
      label: "기념일",
      value: `${activeAnniversaryCount}/${anniversaryCount}`,
      description: "활성 공통 기념일 / 전체 기념일",
      icon: <CalendarDays size={18} />,
    },
    {
      label: "프롬프트",
      value: `${activePromptTemplateCount}/${promptTemplateCount}`,
      description: "활성 프롬프트 / 전체 프롬프트",
      icon: <FileText size={18} />,
    },
    {
      label: "문구",
      value: `${activePhraseCount}/${phraseCount}`,
      description: "활성 문구 / 전체 문구",
      icon: <MessageSquareText size={18} />,
    },
    {
      label: "7일 로그",
      value: logCount7d.toLocaleString(),
      description: "최근 7일 AI 생성 로그",
      icon: <ScrollText size={18} />,
    },
    {
      label: "가입 보너스",
      value: `${settingsResult.data?.signup_bonus_credits ?? 3}C`,
      description: "신규 가입 기본 지급 크레딧",
      icon: <CreditCard size={18} />,
    },
  ];

  const menuGroups: MenuGroup[] = [
    {
      title: "계정 관리",
      description: "사용자, 크레딧, 서비스 운영 설정을 관리합니다.",
      items: [
        {
          href: "/admin/users",
          title: "사용자 관리",
          desc: "사용자 조회, 상태 확인, 크레딧 보정",
          icon: <Users size={20} />,
          tone: "bg-sky-50 text-sky-700",
        },
        {
          href: "/admin/credits",
          title: "크레딧 관리",
          desc: "크레딧 지급, 차감, 거래 기록 확인",
          icon: <CreditCard size={20} />,
          tone: "bg-emerald-50 text-emerald-700",
        },
        {
          href: "/admin/settings",
          title: "운영 설정",
          desc: "가입 보너스, 공지 배너, 손편지 옵션",
          icon: <Settings2 size={20} />,
          tone: "bg-stone-100 text-stone-800",
        },
        ...(canManageAdminRoles(user)
          ? [
              {
                href: "/admin/admin-roles",
                title: "관리자 지정",
                desc: "관리자 계정과 권한 역할 관리",
                icon: <ShieldCheck size={20} />,
                tone: "bg-amber-50 text-amber-700",
              } as MenuItem,
            ]
          : []),
      ],
    },
    {
      title: "콘텐츠 관리",
      description: "배경, 메인 카드, 기념일, 추천 문구를 관리합니다.",
      items: [
        {
          href: "/admin/backgrounds",
          title: "배경 관리",
          desc: "카드 배경 이미지 업로드와 활성 상태 관리",
          icon: <ImageIcon size={20} />,
          tone: "bg-orange-50 text-[#7b310d]",
        },
        {
          href: "/admin/home-cards",
          title: "메인 카드 관리",
          desc: "홈 상단 카드 등록, 수정, 노출 순서 관리",
          icon: <Sparkles size={20} />,
          tone: "bg-amber-50 text-[#7b310d]",
        },
        {
          href: "/admin/common-anniversaries",
          title: "공통 기념일 관리",
          desc: "설날, 어버이날, 스승의날 등 공통 일정 관리",
          icon: <CalendarDays size={20} />,
          tone: "bg-rose-50 text-[#7b310d]",
        },
        {
          href: "/admin/phrases",
          title: "문구 관리",
          desc: "추천 문구와 카테고리별 문구 관리",
          icon: <MessageSquareText size={20} />,
          tone: "bg-teal-50 text-teal-700",
        },
      ],
    },
    {
      title: "AI 관리",
      description: "프롬프트와 생성 로그를 관리합니다.",
      items: [
        {
          href: "/admin/overview",
          title: "운영 요약",
          desc: "현재 운영 상태와 주요 지표 확인",
          icon: <BarChart3 size={20} />,
          tone: "bg-slate-100 text-slate-700",
        },
        {
          href: "/admin/prompt",
          title: "감성 프롬프트 관리",
          desc: "본문, 화풍, 손편지 프롬프트 수정",
          icon: <BarChart3 size={20} />,
          tone: "bg-violet-50 text-violet-700",
        },
        ...(canManageAdminRoles(user)
          ? [
              {
                href: "/admin/prompt-templates",
                title: "프롬프트 템플릿",
                desc: "카드 생성 템플릿 등록, 수정, 활성화",
                icon: <FileText size={20} />,
                tone: "bg-indigo-50 text-indigo-700",
              } as MenuItem,
            ]
          : []),
        {
          href: "/admin/generation-logs",
          title: "생성 로그",
          desc: "AI 이미지 생성 성공과 실패 기록",
          icon: <ScrollText size={20} />,
          tone: "bg-purple-50 text-purple-700",
        },
      ],
    },
  ];

  return (
    <>
      <main className="mx-auto min-h-screen max-w-5xl bg-white px-5 py-6 pb-24">
        <header className="border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-[#7b310d] text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#5a240d]">관리자</h1>
              <p className="mt-1 text-sm font-semibold text-stone-500">{user.email}</p>
            </div>
          </div>
        </header>

        {settingsResult.data?.announcement_enabled && (
          <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-black text-amber-900">{announcementTitle || "서비스 공지"}</p>
            <p className="mt-1 text-xs font-semibold text-amber-700">현재 공지 배너가 활성화되어 있습니다.</p>
          </section>
        )}

        <section className="grid gap-3 border-b border-stone-100 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">{stat.label}</p>
                <span className="grid size-8 place-items-center rounded-md bg-stone-100 text-stone-700">{stat.icon}</span>
              </div>
              <p className="mt-3 text-2xl font-black text-stone-900">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">{stat.description}</p>
            </div>
          ))}
        </section>

        <section className="space-y-6 py-5">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-4">
                <h2 className="text-sm font-black uppercase tracking-[0.12em] text-stone-500">{group.title}</h2>
                <p className="mt-1 text-sm font-semibold text-stone-500">{group.description}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-[#7b310d]"
                  >
                    <div className={`grid size-10 place-items-center rounded-lg ${item.tone}`}>{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-stone-900">{item.title}</div>
                      <p className="mt-1 text-sm font-semibold leading-5 text-stone-500">{item.desc}</p>
                    </div>
                    <ChevronRight size={18} className="text-stone-400 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-lg bg-stone-50 px-4 py-3 text-sm font-semibold leading-6 text-stone-500">
          관리자 계정은 등록된 관리자 이메일과 역할 설정에 따라 접근할 수 있습니다.
        </section>
      </main>
      <BottomNav />
    </>
  );
}
