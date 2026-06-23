import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { MusicPlayer } from "@/components/ui/MusicPlayer";

export const dynamic = "force-dynamic";

const BG_STYLES: Record<string, { swatch: string; mark: string }> = {
  flower: { swatch: "from-rose-100 via-orange-50 to-pink-100", mark: "꽃" },
  mountain: { swatch: "from-sky-100 via-emerald-100 to-lime-100", mark: "산" },
  river: { swatch: "from-cyan-100 via-blue-50 to-emerald-100", mark: "강" },
  sunset: { swatch: "from-orange-200 via-amber-100 to-violet-100", mark: "노을" },
  sea: { swatch: "from-sky-100 via-cyan-100 to-blue-200", mark: "바다" },
  hanok: { swatch: "from-stone-100 via-orange-50 to-rose-100", mark: "한옥" },
  spring: { swatch: "from-lime-100 via-sky-50 to-rose-100", mark: "봄" },
  autumn: { swatch: "from-yellow-100 via-orange-100 to-red-100", mark: "가을" },
  winter: { swatch: "from-slate-100 via-sky-50 to-blue-100", mark: "겨울" },
  cosmic: { swatch: "from-blue-100 via-purple-100 via-pink-100 to-red-100", mark: "우주" },
};

type Props = { params: Promise<{ cardId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cardId } = await params;
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("card_library")
    .select("recipient, honorific, message")
    .eq("id", cardId)
    .eq("is_hidden", false)
    .single();

  if (!card) return { title: "마음카드" };

  const title = `${card.recipient}${card.honorific}에게 보내는 마음카드`;
  const description = card.message.slice(0, 100);
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function SharePage({ params }: Props) {
  const { cardId } = await params;
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("card_library")
    .select("*")
    .eq("id", cardId)
    .eq("is_hidden", false)
    .single();

  const bg =
    card && BG_STYLES[card.background_id]
      ? BG_STYLES[card.background_id]
      : BG_STYLES.flower;
  const aiBackgroundUrl = card?.background_id?.startsWith("ai:")
    ? card.background_id.slice(3)
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-950 px-4 py-8">
      {/* 이미지 중심 — 카드 이미지/GIF 를 화면 가운데 크게 보여준다. */}
      <div className="w-full max-w-md">
        {card?.gif_image_url ? (
          <SmoothImage
            src={card.gif_image_url}
            alt="공유 마음카드 (움직이는 GIF)"
            className="w-full rounded-2xl shadow-2xl"
          />
        ) : card?.card_image_url ? (
          <SmoothImage
            src={card.card_image_url}
            alt="공유 마음카드"
            className="w-full rounded-2xl shadow-2xl"
          />
        ) : (
          <div
            className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br ${bg.swatch} shadow-2xl`}
          >
            {aiBackgroundUrl ? (
              <>
                <SmoothImage
                  src={aiBackgroundUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-white/20" />
              </>
            ) : (
              <>
                <div className="absolute -left-5 bottom-0 text-5xl font-black text-white/60">
                  {bg.mark}
                </div>
                <div className="absolute -right-3 top-3 text-4xl font-black text-white/70">
                  {bg.mark}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-md space-y-3">
        <Link
          href="/create/background"
          className="grid h-14 place-items-center rounded-md bg-[#7b310d] text-lg font-bold text-white"
        >
          나도 마음카드 만들기
        </Link>
        <Link
          href="/"
          className="grid h-12 place-items-center rounded-md border border-white/20 font-semibold text-white/80"
        >
          홈으로
        </Link>
      </div>

      <MusicPlayer autoPlay />
    </main>
  );
}
