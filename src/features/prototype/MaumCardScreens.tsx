"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Cake,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Flower2,
  Folder,
  Heart,
  Home,
  Inbox,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth";
import { saveCard, getMyCards, toggleFavorite as dbToggleFavorite, deleteCard as dbHideCard, hardDeleteCard as dbDeleteCard, deleteAllCards as dbDeleteAllCards, updateCardImageUrl } from "@/lib/cards";
import { getFavoriteMessages, addFavoriteMessage, deleteFavoriteMessage } from "@/lib/favoriteMessages";
import type { FavoriteMessage } from "@/lib/favoriteMessages";
import { getAnniversaries, createAnniversary, updateAnniversary, deleteAnniversary } from "@/lib/anniversaries";
import type { AnniversaryInsertData } from "@/lib/anniversaries";
import { shareCard } from "@/lib/kakao";
import { useAIBackground } from "@/features/card-create/hooks/useAIBackground";
import { CreditBalance } from "@/features/payment/components/CreditBalance";
import { isAdminEmail } from "@/lib/adminAccess";
import { CARD_FONTS } from "@/lib/card-fonts";
import { ThemePanel } from "@/components/layout/ThemeSettings";
import type { Database } from "@/types/supabase";
import Image from "next/image";

type Purpose = "birthday" | "love" | "health" | "thanks" | "comfort" | "congrats" | "morning" | "night" | "hand" | "custom";
type CardItem = {
  id: string;
  name: string;
  purpose: Purpose;
  message: string;
  bg: string;
  createdAt: string;
  favorite?: boolean;
  cardImageUrl?: string | null;
};
type Draft = {
  purpose: Purpose | "";
  name: string;
  recipientPreset: string;
  honorific: string;
  message: string;
  bg: string;
  handFont: HandFont;
  handTone: HandTone;
  handMode: "recommend" | "direct";
  directMode?: boolean; // 직접입력(명언) 진입 의도 — 재정렬 흐름에서 URL 파라미터 대체
  title?: string; // 카드 제목 (받는분 대체, 큰 글씨)
  titleFont?: string; // 제목 글씨체 (card-fonts id)
  contentFont?: string; // 내용 글씨체 (card-fonts id)
  cardPosition?: "auto" | "top" | "center" | "bottom"; // 글씨 배치
  titleScale?: number; // 제목 크기 배율 (기본 1)
  contentScale?: number; // 내용 크기 배율 (기본 1)
  titleColor?: string; // 제목 글자색 ("auto" 또는 hex)
  contentColor?: string; // 내용 글자색 ("auto" 또는 hex)
  footer?: string; // 하단 메세지 (내용 아래)
  authorEnabled?: boolean; // 작성자 표시 여부
  author?: string; // 작성자 이름
};

type HandFont = "round" | "brush" | "pen";
type HandTone = "general" | "love";
type RecommendationCategory = Exclude<Purpose, "hand"> | "all";

const defaultDraft: Draft = {
  purpose: "",
  name: "",
  recipientPreset: "",
  honorific: "에게",
  message: "",
  bg: "flower",
  handFont: "round",
  handTone: "general",
  handMode: "recommend",
};

const draftStorageKey = "maumcard:draft";

function hasDraftProgress(draft: Draft) {
  return Boolean(
    draft.purpose ||
      draft.name.trim() ||
      draft.recipientPreset ||
      draft.message.trim() ||
      draft.title?.trim() ||
      draft.footer?.trim() ||
      draft.author?.trim() ||
      draft.bg !== defaultDraft.bg,
  );
}

function getDraftResumeHref(draft: Draft) {
  if (draft.message.trim()) return "/create/preview";
  if (draft.bg && draft.bg !== defaultDraft.bg) return "/create/message";
  return "/create/background";
}


const messagesByPurpose: Record<Purpose, string[]> = {
  birthday: [
    "생일을 진심으로 축하합니다. 오늘 하루 누구보다 행복하게 보내세요.",
    "당신이 태어난 오늘이 참 고맙습니다. 오래오래 건강하고 웃어주세요.",
    "새로운 한 해에는 더 많은 기쁨과 따뜻한 순간이 함께하길 바랍니다.",
    "소중한 당신의 생일에 마음 가득 축하를 보냅니다.",
    "오늘만큼은 모든 걱정 내려놓고 사랑받는 하루 보내세요.",
  ],
  love: [
    "오늘도 당신의 하루가 따뜻한 햇살처럼 빛나길 바랍니다.",
    "별일 없이 잘 지내고 있는지 문득 생각났어요. 늘 평안하길 바랍니다.",
    "바쁜 하루 속에서도 잠깐 웃을 수 있는 순간이 찾아오길 바라요.",
    "멀리 있어도 마음은 늘 곁에 있습니다. 오늘도 응원합니다.",
    "당신은 세상에서 가장 소중한 사람입니다. 늘 건강하고 행복하세요.",
  ],
  health: [
    "무엇보다 건강이 제일입니다. 오늘도 몸과 마음을 잘 챙기세요.",
    "천천히 쉬어가도 괜찮습니다. 건강한 하루가 되길 바랍니다.",
    "몸도 마음도 편안해지는 시간이 당신 곁에 머물길 바라요.",
    "따뜻한 밥 잘 챙겨 드시고, 오늘도 무리하지 마세요.",
    "건강한 웃음이 오래도록 함께하길 진심으로 바랍니다.",
  ],
  thanks: [
    "늘 곁에 있어서 고맙습니다. 당신의 마음을 오래 기억하겠습니다.",
    "말로 다 표현하지 못했지만, 언제나 깊이 감사하고 있습니다.",
    "당신이 건네준 따뜻함 덕분에 많은 날을 잘 지나왔습니다.",
    "작은 배려 하나하나가 제게 큰 힘이 되었습니다. 고맙습니다.",
    "고마운 마음을 담아 이 카드를 보냅니다. 늘 행복하세요.",
  ],
  comfort: [
    "힘든 날도 지나가고, 다시 웃는 날이 꼭 찾아올 거예요.",
    "지금 충분히 잘하고 있습니다. 너무 스스로를 몰아붙이지 마세요.",
    "오늘은 잠시 쉬어도 괜찮습니다. 당신의 마음이 먼저입니다.",
    "혼자 견디고 있다고 느껴질 때도, 당신을 응원하는 마음이 있습니다.",
    "천천히 가도 괜찮아요. 결국 따뜻한 날이 다시 올 거예요.",
  ],
  congrats: [
    "풍성한 마음과 따뜻한 웃음이 함께하는 명절 보내세요.",
    "소중한 사람들과 평안하고 넉넉한 시간 보내시길 바랍니다.",
    "멀리서나마 감사와 안부를 전합니다. 건강한 명절 되세요.",
    "가정에 웃음과 평안이 가득하길 진심으로 기원합니다.",
    "오랜만의 쉼 속에서 마음까지 넉넉해지는 명절 보내세요.",
  ],
  morning: [
    "좋은 아침입니다. 오늘 하루도 기분 좋게 시작하시길 바랍니다.",
    "따뜻한 햇살처럼 밝고 편안한 하루가 되길 바라요.",
    "오늘도 작은 기쁨을 많이 만나는 하루 보내세요.",
    "새로운 아침이 당신에게 좋은 소식을 데려오길 바랍니다.",
    "무리하지 말고 천천히, 그래도 기분 좋게 시작해요.",
  ],
  night: [
    "오늘 하루도 수고 많았습니다. 편안한 밤 보내세요.",
    "고단했던 마음을 내려놓고 깊이 쉬는 밤이 되길 바랍니다.",
    "내일은 오늘보다 조금 더 가벼운 하루가 찾아오길 바라요.",
    "따뜻한 꿈 꾸시고, 몸과 마음 모두 편히 쉬세요.",
    "오늘도 잘 버텨낸 당신에게 조용한 응원을 보냅니다.",
  ],
  hand: [
    "오래 마음속에만 두었던 이야기를 이제는 편지로 조심스럽게 전해봅니다. 당신을 떠올릴 때마다 먼저 드는 감정은 감사와 응원입니다. 늘 제 몫보다 더 많은 마음을 내어주고, 힘든 날에도 티 내지 않고 버텨준 당신의 시간이 참 고맙습니다. 오늘 이 편지가 당신의 하루에 작은 쉼표가 되길 바라며, 잠깐이라도 미소가 머물렀으면 좋겠습니다. 아무 말 없이 지나가도 마음은 늘 당신 편입니다.",
    "짧은 인사로는 다 담기지 않는 마음이 있어 이렇게 길게 적어봅니다. 당신은 늘 주변을 먼저 챙기느라 자신을 뒤로 미루곤 했지요. 그래서 저는 오늘만큼은 당신이 먼저 편안했으면 좋겠습니다. 따뜻한 밥 잘 챙겨 드시고, 지친 마음은 잠시 내려두고, 아주 조금은 자신에게도 다정해지길 바랍니다. 당신의 하루가 생각보다 가볍길 바랍니다. 쉬어가는 시간도 꼭 필요하니까요.",
    "당신이 무심히 지나치는 하루에도 저는 자주 고마움을 느낍니다. 말하지 않아도 전해지는 배려, 아무렇지 않게 건네는 다정함, 그리고 묵묵히 자리를 지켜주는 성실함까지 모두 마음에 남아 있습니다. 이 편지가 닿는 순간만큼은 당신이 혼자가 아니라는 걸 기억해 주셨으면 좋겠습니다. 오늘도 수고 많았다는 말을 꼭 전하고 싶습니다. 늘 그랬듯 당신은 충분히 잘하고 있습니다.",
  ],
  custom: [
    "행복은 멀리 있는 것이 아니라, 지금 이 순간을 느끼는 데서 시작된다.",
    "오늘의 나를 만든 것은 어제의 작은 용기들이었다.",
    "좋은 말은 마음을 살리고, 따뜻한 시선은 하루를 바꾼다.",
    "천천히 가도 괜찮다. 중요한 건 멈추지 않는 것이다.",
    "마음이 흔들릴 때일수록, 내가 믿는 가치를 떠올려보자.",
  ],
};

const longMessagesByPurpose: Record<Purpose, string[]> = {
  birthday: [
    "생일을 진심으로 축하합니다.\n\n한 해 한 해가 지날수록 더 많은 것을 이뤄가시고, 더 많은 행복을 누리시길 바랍니다. 오늘 하루만큼은 세상 모든 걱정 내려놓고 스스로를 충분히 사랑해 주세요. 소중한 당신의 생일을 함께 축하할 수 있어서 감사합니다.",
    "태어나주셔서 고맙습니다.\n\n당신이 이 세상에 존재하는 것만으로도 주변이 따뜻해집니다. 오늘 이 날이 앞으로의 365일 중 가장 빛나는 하루가 되길, 그리고 내년 이맘때도 건강하고 환하게 웃고 있길 진심으로 바랍니다.",
    "이 특별한 날, 마음을 다해 축하 인사를 전합니다.\n\n새로운 나이만큼 새로운 기쁨이 찾아오길 바랍니다. 지난 한 해 동안 고생 많으셨고, 앞으로의 시간은 더욱 풍요롭고 행복하길 진심으로 응원합니다.",
  ],
  love: [
    "안녕하세요, 잘 지내고 계신지요.\n\n문득 당신이 생각나 마음을 전합니다. 바쁜 일상 속에서도 잠깐씩 쉬어가며, 좋아하는 것들로 하루를 채워가시길 바랍니다. 멀리서도 늘 응원하고 있다는 것, 기억해 주세요.",
    "오늘 하루는 어떠셨나요.\n\n별다른 이유 없이 그냥 연락하고 싶었습니다. 요즘 많이 바쁘실 텐데, 밥은 잘 챙겨 드시고 계신지요. 잠깐이라도 스스로를 위한 시간을 갖고, 오늘 하루도 편안하게 마무리하시길 바랍니다.",
    "가끔 이렇게 안부를 전하고 싶어집니다.\n\n당신이 어떻게 지내는지, 요즘은 무엇이 즐거운지 궁금해요. 바쁜 하루하루지만 그 속에서도 작은 행복을 발견하시길, 그리고 언제나 건강하시길 바랍니다.",
  ],
  health: [
    "무엇보다 건강이 제일입니다.\n\n요즘 몸은 좀 어떠신가요. 날씨가 변덕스러운 만큼 체온 조절에 신경 써주시고, 식사도 거르지 말고 꼭 챙겨 드세요. 마음까지 평온한 하루하루가 쌓이길 진심으로 바랍니다.",
    "건강한 몸과 마음으로 오래오래 함께하고 싶습니다.\n\n억지로 무언가를 하지 않아도 괜찮으니, 오늘만큼은 충분히 쉬어가세요. 작은 것에 감사하며 천천히, 그렇게 건강한 하루를 쌓아가시길 응원합니다.",
    "몸 관리 잘 하고 계신가요.\n\n무리하지 마시고 몸이 보내는 신호에 귀를 기울여 주세요. 충분한 수면과 따뜻한 식사, 그리고 가끔은 산책도 좋습니다. 건강하고 활기찬 하루가 언제나 함께하길 바랍니다.",
  ],
  thanks: [
    "고맙다는 말을 자주 하지 못해 미안합니다.\n\n당신이 곁에 있어 준 덕분에 많은 날들을 버텨올 수 있었습니다. 작은 배려 하나하나가 제게는 커다란 힘이 되었어요. 이 마음이 닿길 바라며, 진심으로 감사를 전합니다.",
    "말로는 다 표현할 수 없지만, 언제나 감사하게 생각하고 있습니다.\n\n당신이 건네준 따뜻한 말 한마디, 아무렇지 않게 내밀어 준 손길들이 오랫동안 제 기억에 남아 있습니다. 앞으로도 늘 건강하고 행복하시길 바랍니다.",
    "이 카드 한 장에 마음을 담아 보냅니다.\n\n평소에 감사하다는 말을 쉽게 꺼내지 못했지만, 당신이 저에게 얼마나 큰 힘이 되어왔는지 늘 알고 있었습니다. 진심으로, 고맙습니다.",
  ],
  comfort: [
    "지금 많이 힘드시죠.\n\n억지로 괜찮은 척 하지 않아도 됩니다. 울고 싶을 때 울어도 되고, 쉬고 싶을 때 쉬어도 됩니다. 이 시간이 지나면 분명 다시 웃을 날이 찾아올 거예요. 그때까지 저도 곁에 있겠습니다.",
    "아무 말 하지 않아도 괜찮습니다.\n\n그냥 함께 있어 드리고 싶었어요. 지금 이 순간이 얼마나 힘든지 알고 있습니다. 천천히, 한 발씩, 당신의 속도로 걸어가도 충분합니다. 늘 응원하고 있습니다.",
    "힘든 날에는 힘들다고 말해도 괜찮습니다.\n\n모든 것을 혼자 감당하려 하지 않아도 돼요. 지쳐있을 때 기댈 수 있는 사람이 곁에 있다는 것, 잊지 마세요. 당신이 다시 웃는 날이 어서 오길 바랍니다.",
  ],
  congrats: [
    "따뜻한 명절 인사를 전합니다.\n\n바쁜 일상 속에서 오랜만에 소중한 분들과 함께하는 시간이 되길 바랍니다. 가정에 건강과 웃음이 가득하고, 이 명절이 오래도록 따뜻한 기억으로 남길 진심으로 기원합니다.",
    "풍성하고 따뜻한 명절 보내세요.\n\n멀리서나마 온 가족의 건강과 행복을 기원합니다. 지난 한 해 고생 많으셨습니다. 이번 명절만큼은 편안하게 쉬시고, 가까운 분들과 따뜻한 시간 나누시길 바랍니다.",
    "명절을 맞아 안부를 전합니다.\n\n올 한 해도 건강하고 행복하게 지내시길 바랍니다. 가족들과 함께하는 이 시간이 서로에게 큰 힘이 되길, 그리고 내내 좋은 기억만 쌓이길 진심으로 바랍니다.",
  ],
  morning: [
    "좋은 아침입니다.\n\n오늘 하루도 무리하지 말고 천천히 시작하세요. 어제보다 조금 더 편안한 하루가 되길, 그리고 오늘 작은 기쁨을 하나라도 만나게 되길 진심으로 바랍니다. 따뜻한 하루 보내세요.",
    "새로운 하루가 밝았습니다.\n\n커피 한 잔의 여유처럼, 오늘 하루가 잔잔하고 포근하게 흘러가길 바랍니다. 너무 열심히 하려 하지 않아도 괜찮아요. 그냥 오늘을 살아내는 것만으로도 충분합니다.",
    "아침 햇살처럼 따뜻한 하루가 되길 바랍니다.\n\n오늘도 당신만의 속도로 하루를 시작하세요. 서두르지 않아도 되고, 완벽하지 않아도 됩니다. 그냥 오늘의 당신으로 충분합니다.",
  ],
  night: [
    "오늘 하루도 수고 많으셨습니다.\n\n하루 종일 애쓰신 몸과 마음이 충분히 쉴 수 있는 밤이 되길 바랍니다. 잠들기 전 잠깐이라도 오늘 있었던 작은 좋은 일들을 떠올려보세요. 편안한 밤 보내시길 바랍니다.",
    "고단했던 하루가 저물고 있습니다.\n\n오늘도 최선을 다하신 당신, 정말 잘하셨습니다. 이제는 모든 것을 내려놓고 깊은 휴식을 취하세요. 내일은 오늘보다 더 좋은 하루가 찾아올 거예요. 좋은 꿈 꾸세요.",
    "이 밤, 당신이 편안하길 바랍니다.\n\n오늘 하루 어떤 감정을 느끼셨든, 지금 이 순간만큼은 그 모든 것을 내려놓으세요. 따뜻한 밤, 깊은 잠, 그리고 내일의 새로운 시작을 응원합니다.",
  ],
  hand: [
    "오랫동안 전하고 싶었던 마음을 이제야 편지로 적어봅니다.\n\n말로는 자주 하지 못했지만, 당신을 생각할 때마다 늘 감사한 마음이 먼저 떠올랐습니다. 바쁜 하루 속에서도 당신이 건강하고 편안하길 바라며, 힘들 때에는 잠시 쉬어갈 수 있기를 바랍니다. 이 편지가 당신의 마음에 작은 온기가 되길 진심으로 바랍니다. 오늘 하루만큼은 걱정이 조금 줄어들었으면 합니다. 편안히 숨 쉬는 시간도 당신에게 필요합니다.",
    "조금은 긴 글로 마음을 전하고 싶었습니다.\n\n전하지 못한 고마움과 응원을 이 편지에 담아 조심스럽게 보냅니다. 늘 주변을 먼저 챙기느라 자신을 뒤로 미루는 당신이 오늘만큼은 조금 더 편안했으면 좋겠습니다. 당신의 하루가 무리 없이 흘러가고, 웃음이 조금 더 자주 머물기를 응원합니다. 늘 무리하지 말고 몸과 마음을 함께 챙겨주세요. 오늘은 당신이 조금 더 쉬어도 괜찮습니다.",
    "짧은 인사보다 오래 남는 편지를 쓰고 싶었습니다.\n\n당신이 걸어온 시간은 충분히 소중했고, 지금의 당신 역시 정말 잘하고 있습니다. 아무도 알아주지 않는 것 같아도 묵묵히 버텨온 마음을 저는 알고 있습니다. 오늘 이 편지 한 장이 당신에게 따뜻한 쉼표가 되었으면 좋겠습니다. 아주 작은 위로라도 된다면 그걸로 충분합니다. 내일의 당신이 오늘보다 조금 더 가벼워지길 바랍니다.",
  ],
  custom: [
    "좋은 문장은 마음을 다잡아 줍니다.\n\n짧은 말 한 줄이 오늘의 방향이 되기도 하고, 오래 남는 울림이 되기도 합니다. 마음에 닿는 문장을 골라 당신만의 기준으로 삼아보세요.",
    "명언은 누군가의 생각을 빌려와 지금의 나를 비춰보는 거울입니다.\n\n전하고 싶은 마음이 있다면, 그 마음에 맞는 문장을 천천히 골라보세요. 짧지만 깊은 문장은 오래 기억에 남습니다.",
    "때로는 내 생각보다 남의 문장이 더 정확하게 내 마음을 설명합니다.\n\n지금 당신에게 필요한 한 줄을 찾아보세요. 그 문장은 오늘을 버티게 해 주는 작은 힘이 될 수 있습니다.",
  ],
};

const recommendationCategoryLabels: Record<RecommendationCategory, string> = {
  all: "전체",
  birthday: "생일",
  love: "안부",
  health: "건강",
  thanks: "감사",
  comfort: "위로",
  congrats: "명절",
  morning: "아침 인사",
  night: "저녁 인사",
  custom: "명언",
};

const recommendationCategoryOrder: RecommendationCategory[] = [
  "all",
  "birthday",
  "love",
  "health",
  "thanks",
  "comfort",
  "congrats",
  "morning",
  "night",
  "custom",
];

function getOrderedRecommendationCategories(anchor: RecommendationCategory) {
  if (anchor === "all") return recommendationCategoryOrder.slice(1);
  // 특정 카테고리 선택 시 해당 카테고리만 노출 (목록 길이 단축)
  return [anchor];
}

function getRecommendedGroups(
  source: Record<Purpose, string[]>,
  anchor: RecommendationCategory,
): Array<{ purpose: Exclude<Purpose, "hand">; label: string; messages: string[] }> {
  return getOrderedRecommendationCategories(anchor)
    .filter((purpose): purpose is Exclude<Purpose, "hand"> => purpose !== "all")
    .map((purpose) => ({
      purpose,
      label: recommendationCategoryLabels[purpose],
      messages: Array.from(new Set(source[purpose] ?? [])),
    }))
    .filter((group) => group.messages.length > 0);
}

const handMessagesGeneral = Array.from(
  new Set([...messagesByPurpose.hand, ...longMessagesByPurpose.hand]),
);

const handMessagesLove = [
  "어떤 날엔 가만히 생각만 해도 마음이 이상하게 따뜻해집니다. 당신을 좋아하는 마음은 자꾸만 커져서, 안부를 전하는 짧은 말에도 설렘이 섞입니다. 오늘도 당신의 하루가 환하게 웃는 일들로 가득하길 바랍니다. 이런 마음을 전할 수 있어 참 다행입니다.",
  "당신을 떠올리면 늘 조금 빨리 뛰는 마음을 숨길 수가 없습니다. 보고 싶은 마음, 고마운 마음, 좋아하는 마음이 함께 모여 이 편지가 되었습니다. 오늘도 무사히, 그리고 환하게 웃으며 지내고 있기를 바랍니다. 언젠가 이 마음이 당신에게 닿아도 괜찮다면 좋겠습니다.",
  "사실은 자주 보고 싶고, 자주 궁금합니다. 바쁜 하루 중에도 당신의 소식 하나에 마음이 들뜨고, 짧은 대화에도 오래 웃게 됩니다. 이 편지에는 그런 설레는 마음을 조심스럽게 담아 보냅니다. 당신의 오늘이 포근하고, 당신의 밤이 따뜻하길 바랍니다.",
];

const handMessagesByTone: Record<HandTone, string[]> = {
  general: handMessagesGeneral,
  love: handMessagesLove,
};

const handMessageMaxLengthByTone: Record<HandTone, number> = {
  general: 350,
  love: 300,
};

const handFontOptions: Array<{
  id: HandFont;
  label: string;
  sample: string;
  fontFamily: string;
}> = [
  {
    id: "round",
    label: "둥근 펜체",
    sample: "따뜻하고 부드러운 느낌",
    fontFamily: '"Nanum Pen Script","Apple SD Gothic Neo","Segoe Print",cursive',
  },
  {
    id: "brush",
    label: "붓글씨",
    sample: "진심이 묻어나는 느낌",
    fontFamily: '"Nanum Brush Script","Malgun Gothic","Apple SD Gothic Neo",cursive',
  },
  {
    id: "pen",
    label: "얇은 손글씨",
    sample: "담백하고 섬세한 느낌",
    fontFamily: '"Segoe Print","Nanum Pen Script","Apple SD Gothic Neo",cursive',
  },
];

// 손편지 가독성 우선: 손글씨체 대신 나눔고딕(웹폰트 없으면 시스템 고딕 폴백)으로 표시
const HAND_GOTHIC_FONT = '"Nanum Gothic","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

const recipientPresetOptions = ["어머니", "아버지", "친구야", "선생님"];
const honorificOptions = ["에게", "님", "씨", ...recipientPresetOptions];

const backgrounds = [
  { id: "flower", swatch: "from-rose-100 via-orange-50 to-pink-100", mark: "🌸" },
  { id: "mountain", swatch: "from-sky-100 via-emerald-100 to-lime-100", mark: "⛰️" },
  { id: "river", swatch: "from-cyan-100 via-blue-50 to-emerald-100", mark: "🏞️" },
  { id: "sunset", swatch: "from-orange-200 via-amber-100 to-violet-100", mark: "🌅" },
  { id: "sea", swatch: "from-sky-100 via-cyan-100 to-blue-200", mark: "🌊" },
  { id: "hanok", swatch: "from-stone-100 via-orange-50 to-rose-100", mark: "🏯" },
  { id: "spring", swatch: "from-lime-100 via-sky-50 to-rose-100", mark: "🌤️" },
  { id: "autumn", swatch: "from-yellow-100 via-orange-100 to-red-100", mark: "🍂" },
  { id: "winter", swatch: "from-slate-100 via-sky-50 to-blue-100", mark: "❄️" },
  { id: "sakura", swatch: "from-pink-100 via-rose-50 to-fuchsia-100", mark: "🌺" },
  { id: "forest", swatch: "from-emerald-100 via-green-50 to-teal-100", mark: "🌲" },
  { id: "starry", swatch: "from-indigo-200 via-violet-100 to-purple-200", mark: "✨" },
  { id: "aurora", swatch: "from-teal-100 via-cyan-50 to-violet-100", mark: "🌌" },
  { id: "lavender", swatch: "from-purple-100 via-violet-50 to-pink-100", mark: "💜" },
  { id: "cafe", swatch: "from-amber-100 via-stone-50 to-orange-100", mark: "☕" },
  { id: "beach", swatch: "from-yellow-100 via-amber-50 to-cyan-100", mark: "🏖️" },
  { id: "rainbow", swatch: "from-red-100 via-yellow-100 to-blue-100", mark: "🌈" },
  { id: "cherry", swatch: "from-red-100 via-pink-50 to-rose-200", mark: "🍒" },
  { id: "bamboo", swatch: "from-green-100 via-emerald-50 to-lime-100", mark: "🎋" },
  { id: "cosmos", swatch: "from-violet-200 via-indigo-100 to-blue-200", mark: "🪐" },
  { id: "maple", swatch: "from-red-200 via-orange-100 to-yellow-100", mark: "🍁" },
  { id: "snow", swatch: "from-blue-50 via-slate-50 to-sky-100", mark: "⛄" },
  { id: "garden", swatch: "from-green-50 via-rose-50 to-lime-100", mark: "🌷" },
  { id: "rain", swatch: "from-slate-100 via-blue-50 to-gray-100", mark: "🌧️" },
  { id: "morning_light", swatch: "from-amber-50 via-yellow-50 to-orange-100", mark: "🌄" },
  { id: "night_city", swatch: "from-gray-800 via-slate-700 to-indigo-900", mark: "🌃" },
  { id: "peach", swatch: "from-orange-50 via-rose-50 to-pink-50", mark: "🍑" },
  { id: "ocean_deep", swatch: "from-blue-200 via-cyan-100 to-teal-200", mark: "🐚" },
  { id: "gold", swatch: "from-yellow-100 via-amber-100 to-yellow-200", mark: "🌟" },
  { id: "mint", swatch: "from-teal-50 via-green-50 to-cyan-100", mark: "🌿" },
];

const defaultCards: CardItem[] = [
  {
    id: "sample-1",
    name: "문주",
    purpose: "love",
    message: "당신을 응원합니다. 오늘도 행복하세요.",
    bg: "flower",
    createdAt: "2026.05.14",
    favorite: true,
  },
  {
    id: "sample-2",
    name: "어머니",
    purpose: "birthday",
    message: "세상에서 가장 따뜻한 분, 늘 건강하고 행복하세요.",
    bg: "spring",
    createdAt: "2026.05.13",
  },
];


function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function useDraft() {
  const [draft, setDraftState] = useState<Draft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraftState({ ...defaultDraft, ...readJson<Draft>(draftStorageKey, defaultDraft) });
    setHydrated(true);
  }, []);

  const setDraft = useCallback((next: Partial<Draft>) => {
    setDraftState((prev) => {
      const value = { ...prev, ...next };
      writeJson(draftStorageKey, value);
      return value;
    });
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState(defaultDraft);
    writeJson(draftStorageKey, defaultDraft);
  }, []);

  return [draft, setDraft, hydrated, resetDraft] as const;
}

type DbCard = Database["public"]["Tables"]["card_library"]["Row"];

function mapDbCard(dbCard: DbCard): CardItem {
  const images = readJson<Record<string, string>>("maumcard:card-images", {});
  return {
    id: dbCard.id,
    name: dbCard.recipient,
    purpose: dbCard.purpose as Purpose,
    message: dbCard.message,
    bg: dbCard.background_id,
    createdAt: new Date(dbCard.created_at).toLocaleDateString("ko-KR").replace(/\.$/, ""),
    favorite: dbCard.is_favorite,
    cardImageUrl: dbCard.card_image_url ?? images[dbCard.id] ?? null,
  };
}

function useFavMessages() {
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getFavoriteMessages();
      setFavorites(data);
    } catch {
      /* not logged in */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (text: string, purpose?: string) => {
    await addFavoriteMessage(text, purpose);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteFavoriteMessage(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isSaved = useCallback((text: string) => favorites.some((f) => f.text === text), [favorites]);

  const toggle = useCallback(async (text: string, purpose?: string) => {
    const existing = favorites.find((f) => f.text === text);
    if (existing) {
      await remove(existing.id);
    } else {
      await add(text, purpose);
    }
  }, [favorites, add, remove]);

  return { favorites, loading, add, remove, isSaved, toggle };
}

function useSupabaseCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getMyCards();
      setCards(data.length > 0 ? data.map(mapDbCard) : []);
    } catch {
      if (!loadedRef.current) setCards(defaultCards);
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addCard = useCallback(async (draft: Draft, composedImageBlob?: Blob | null): Promise<string | null> => {
    // 보관함 제목 = 미리보기 제목(없으면 내용 일부)
    const cardTitle = draft.title?.trim() || draft.message?.trim().slice(0, 12) || "무제";
    try {
      const card = await saveCard({
        purpose: draft.purpose || "love",
        recipient: cardTitle,
        honorific: draft.honorific || "에게",
        message: draft.message,
        background_id: draft.bg,
        is_ai_bg: draft.bg.startsWith("ai:"),
      });

      // Upload composed image to Supabase Storage and persist URL in localStorage
      let uploadedCardImageUrl: string | null = null;
      if (composedImageBlob) {
        try {
          const supabase = createClient();
          const fileName = `cards/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
          const { error: uploadError } = await supabase.storage
            .from("card-images")
            .upload(fileName, composedImageBlob, { contentType: "image/png", upsert: false });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(fileName);
            uploadedCardImageUrl = publicUrl;
            await updateCardImageUrl(card.id, publicUrl).catch((e) => console.error("카드 이미지 URL 저장 실패:", e));
            const images = readJson<Record<string, string>>("maumcard:card-images", {});
            writeJson("maumcard:card-images", { ...images, [card.id]: publicUrl });
          }
        } catch {
          // Storage upload failed — continue without image
        }
      }

      await refresh();
      if (uploadedCardImageUrl) {
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, cardImageUrl: uploadedCardImageUrl } : c));
      }
      return card.id;
    } catch {
      // 미로그인 상태 — localStorage에 임시 저장 후 로컬 ID 반환
      const localId = `local-${Date.now()}`;
      const localCard: CardItem = {
        id: localId,
        name: cardTitle,
        purpose: (draft.purpose || "love") as Purpose,
        message: draft.message,
        bg: draft.bg,
        createdAt: new Date().toLocaleDateString("ko-KR").replace(/\.$/, ""),
      };
      if (composedImageBlob) {
        localCard.cardImageUrl = URL.createObjectURL(composedImageBlob);
      }
      const existing = readJson<CardItem[]>("maumcard:cards", []);
      writeJson("maumcard:cards", [localCard, ...existing]);
      setCards((prev) => [localCard, ...prev]);
      return localId;
    }
  }, [refresh]);

  const toggleFav = useCallback(async (cardId: string, isFavorite: boolean) => {
    try {
      await dbToggleFavorite(cardId, isFavorite);
      setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, favorite: isFavorite } : c));
    } catch (error) {
      console.error("즐겨찾기 변경 실패:", error);
    }
  }, []);

  const hideCard = useCallback(async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    const local = readJson<CardItem[]>("maumcard:cards", []);
    writeJson("maumcard:cards", local.filter((c) => c.id !== cardId));
    if (!cardId.startsWith("local-") && !cardId.startsWith("sample-")) {
      await dbHideCard(cardId).catch((e) => console.error("카드 숨김 실패:", e));
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    const local = readJson<CardItem[]>("maumcard:cards", []);
    writeJson("maumcard:cards", local.filter((c) => c.id !== cardId));
    if (!cardId.startsWith("local-") && !cardId.startsWith("sample-")) {
      await dbDeleteCard(cardId).catch((e) => console.error("카드 삭제 실패:", e));
    }
  }, []);

  const deleteAll = useCallback(async () => {
    setCards([]);
    writeJson("maumcard:cards", []);
    await dbDeleteAllCards().catch((e) => console.error("전체 삭제 실패:", e));
  }, []);

  return { cards, loading, addCard, toggleFav, hideCard, deleteCard, deleteAll };
}

type AnnivItem = Database["public"]["Tables"]["anniversaries"]["Row"];

function useSupabaseAnniversaries() {
  const [items, setItems] = useState<AnnivItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await getAnniversaries();
      setItems(data);
    } catch {
      // not logged in or DB not configured
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (data: AnniversaryInsertData) => {
    await createAnniversary(data);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: string, data: AnniversaryInsertData) => {
    await updateAnniversary({ id, ...data });
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteAnniversary(id);
    setItems((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { items, refresh, add, update, remove };
}

function useAiEnabled() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { ai_suggestions_enabled?: boolean }) => {
        if (typeof d.ai_suggestions_enabled === "boolean") setEnabled(d.ai_suggestions_enabled);
      })
      .catch(() => {});
  }, []);
  return enabled;
}

type PublicUiSettings = {
  ai_background_enabled: boolean;
  ai_compose_enabled: boolean;
  hand_font_round_enabled: boolean;
  hand_font_brush_enabled: boolean;
  hand_font_pen_enabled: boolean;
  hand_paper_enabled: boolean;
  hand_paper_style: string;
  hand_compose_font_size: number;
  hand_viewer_font_size: number;
};

function usePublicUiSettings() {
  const [settings, setSettings] = useState<PublicUiSettings>({
    ai_background_enabled: false,
    ai_compose_enabled: false,
    hand_font_round_enabled: true,
    hand_font_brush_enabled: true,
    hand_font_pen_enabled: true,
    hand_paper_enabled: true,
    hand_paper_style: "hanji",
    hand_compose_font_size: 18,
    hand_viewer_font_size: 18,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Partial<PublicUiSettings>) => {
        setSettings((prev) => ({
          ai_background_enabled: typeof d.ai_background_enabled === "boolean" ? d.ai_background_enabled : prev.ai_background_enabled,
          ai_compose_enabled: typeof d.ai_compose_enabled === "boolean" ? d.ai_compose_enabled : prev.ai_compose_enabled,
          hand_font_round_enabled: typeof d.hand_font_round_enabled === "boolean" ? d.hand_font_round_enabled : prev.hand_font_round_enabled,
          hand_font_brush_enabled: typeof d.hand_font_brush_enabled === "boolean" ? d.hand_font_brush_enabled : prev.hand_font_brush_enabled,
          hand_font_pen_enabled: typeof d.hand_font_pen_enabled === "boolean" ? d.hand_font_pen_enabled : prev.hand_font_pen_enabled,
          hand_paper_enabled: typeof d.hand_paper_enabled === "boolean" ? d.hand_paper_enabled : prev.hand_paper_enabled,
          hand_paper_style: typeof d.hand_paper_style === "string" && d.hand_paper_style.trim() ? d.hand_paper_style : prev.hand_paper_style,
          hand_compose_font_size: typeof d.hand_compose_font_size === "number" ? d.hand_compose_font_size : prev.hand_compose_font_size,
          hand_viewer_font_size: typeof d.hand_viewer_font_size === "number" ? d.hand_viewer_font_size : prev.hand_viewer_font_size,
        }));
      })
      .catch(() => {});
  }, []);

  return settings;
}

type AuthUser = {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  credits: number;
};

type CreditTransaction = Database["public"]["Tables"]["credit_transactions"]["Row"];

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());

  const loadProfile = useCallback(async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    const supabase = supabaseRef.current;
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, credits")
      .eq("id", authUser.id)
      .single();

    setUser({
      id: authUser.id,
      email: authUser.email ?? null,
      nickname: profile?.nickname ?? (typeof authUser.user_metadata?.full_name === "string" ? authUser.user_metadata.full_name : null) ?? "마음이",
      avatarUrl: profile?.avatar_url ?? (typeof authUser.user_metadata?.avatar_url === "string" ? authUser.user_metadata.avatar_url : null),
      credits: profile?.credits ?? 0,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = supabaseRef.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) {
        setUser(null);
        return;
      }
      await loadProfile(authUser);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    load();
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      loadProfile(session.user)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, [load, loadProfile]);

  return { user, loading, refresh: load };
}

function useCreditTransactions() {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransactions(data ?? []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { transactions, loading, refresh };
}

function Avatar({ url, nickname, size = 40 }: { url: string | null; nickname: string; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nickname}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-full bg-orange-100 font-bold text-[#7b310d]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {nickname[0]}
    </div>
  );
}

function Header({ title, backHref }: { title?: string; backHref?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [themeOpen, setThemeOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-stone-200 bg-white/95 px-4">
        {backHref ? (
          <Link href={backHref} aria-label="뒤로가기" className="grid h-10 w-10 place-items-center">
            <ChevronLeft size={24} />
          </Link>
        ) : (
          <button type="button" aria-label="뒤로가기" onClick={() => router.back()} className="grid h-10 w-10 place-items-center">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="text-center">
          <div className="text-lg font-black leading-none text-[#5a240d]">💞 마음카드</div>
          <div className="mt-1 text-[11px] font-semibold text-stone-600">{title ?? "마음을 전하는 감성 메시지"}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="디자인 설정"
          >
            <Settings size={18} />
          </button>
          <Link href="/mypage" aria-label="마이페이지" className="grid h-9 w-9 place-items-center">
            {user
              ? <Avatar url={user.avatarUrl} nickname={user.nickname} size={34} />
              : <User size={20} className="text-stone-500" />
            }
          </Link>
        </div>
      </header>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
    </>
  );
}

function PhoneShell({
  children,
  title,
  backHref,
  hideHeader = false,
}: {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  hideHeader?: boolean;
}) {
  return (
    <main className="app-shell mx-auto min-h-screen w-full max-w-md text-stone-950 shadow-[0_0_0_1px_rgba(28,25,23,0.06)] sm:max-w-2xl lg:max-w-5xl">
      {!hideHeader && <Header title={title} backHref={backHref} />}
      <div className={hideHeader ? "pb-24" : "px-4 pb-24 pt-5 sm:px-6 lg:px-8"}>{children}</div>
    </main>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-md bg-[#7b310d] px-4 py-3 text-center font-bold text-white shadow-sm transition active:scale-[0.99] disabled:bg-stone-300 ${props.className ?? ""}`}
    />
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-12 items-center justify-center gap-2 rounded-md border border-[#7b310d]-strong bg-white font-bold text-[#7b310d]">
      {children}
    </Link>
  );
}

function CardArt({ card }: { card: Pick<CardItem, "name" | "message" | "bg" | "cardImageUrl"> }) {
  // If we have the actual composed card image, show it directly
  if (card.cardImageUrl) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.cardImageUrl}
          alt={`${card.name}에게 보내는 카드`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const bg = backgrounds.find((item) => item.id === card.bg) ?? backgrounds[0];
  const isImageBg =
    card.bg.startsWith("ai:") ||
    card.bg.startsWith("https://") ||
    card.bg.startsWith("http://") ||
    card.bg.startsWith("data:");
  const imageUrl = card.bg.startsWith("ai:") ? card.bg.slice(3) : isImageBg ? card.bg : null;

  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg ${!imageUrl ? `bg-gradient-to-br ${bg.swatch}` : "bg-stone-200"}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <>
          <div className="absolute -left-6 bottom-12 text-[110px] opacity-40">{bg.mark}</div>
          <div className="absolute -right-4 top-10 text-[90px] opacity-50">{bg.mark}</div>
        </>
      )}
    </div>
  );
}

type DefaultAnniversary = {
  id: string;
  name: string;
  month?: number;
  day?: number;
  yearlyDates?: Record<number, string>;
  anniversary_type: string;
  memo: string;
  is_active?: boolean;
  sort_order?: number;
};

type CommonAnniversarySetting = {
  max_visible: number;
  window_days: number;
};

const KOREAN_DEFAULT_ANNIVERSARIES: DefaultAnniversary[] = [
  { id: "new-year", name: "신정", month: 1, day: 1, anniversary_type: "other", memo: "새해 인사를 전하기 좋은 날" },
  { id: "seollal", name: "설날", yearlyDates: { 2026: "2026-02-17", 2027: "2027-02-06" }, anniversary_type: "family", memo: "가족에게 새해 인사를 전하세요" },
  { id: "daeboreum", name: "정월대보름", yearlyDates: { 2026: "2026-03-03", 2027: "2027-02-21" }, anniversary_type: "other", memo: "한 해의 건강과 안녕을 기원하는 날" },
  { id: "valentine", name: "밸런타인데이", month: 2, day: 14, anniversary_type: "love", memo: "좋아하는 마음을 전하세요" },
  { id: "independence", name: "삼일절", month: 3, day: 1, anniversary_type: "other", memo: "나라를 생각하는 기념일" },
  { id: "white-day", name: "화이트데이", month: 3, day: 14, anniversary_type: "love", memo: "고마운 마음을 달콤하게 전하세요" },
  { id: "arbor-day", name: "식목일", month: 4, day: 5, anniversary_type: "other", memo: "봄의 마음을 나누기 좋은 날" },
  { id: "black-day", name: "블랙데이", month: 4, day: 14, anniversary_type: "friendship", memo: "혼자여도 괜찮다는 응원을 보내세요" },
  { id: "labor-day", name: "근로자의 날", month: 5, day: 1, anniversary_type: "thanks", memo: "수고한 사람에게 고마움을 전하세요" },
  { id: "children-day", name: "어린이날", month: 5, day: 5, anniversary_type: "family", memo: "아이에게 사랑과 응원을 전하세요" },
  { id: "parents-day", name: "어버이날", month: 5, day: 8, anniversary_type: "family", memo: "부모님께 감사 인사를 전하세요" },
  { id: "buddha", name: "부처님오신날", yearlyDates: { 2026: "2026-05-24", 2027: "2027-05-13" }, anniversary_type: "other", memo: "평온한 마음을 나누는 날" },
  { id: "teacher-day", name: "스승의 날", month: 5, day: 15, anniversary_type: "thanks", memo: "선생님께 감사의 마음을 전하세요" },
  { id: "adult-day", name: "성년의 날", yearlyDates: { 2026: "2026-05-18", 2027: "2027-05-17" }, anniversary_type: "congrats", memo: "새로운 시작을 축하하세요" },
  { id: "dano", name: "단오", yearlyDates: { 2026: "2026-06-19", 2027: "2027-06-09" }, anniversary_type: "other", memo: "여름을 맞는 전통 명절" },
  { id: "memorial-day", name: "현충일", month: 6, day: 6, anniversary_type: "other", memo: "감사와 추모의 마음을 전하세요" },
  { id: "korean-war", name: "6.25 전쟁일", month: 6, day: 25, anniversary_type: "other", memo: "기억과 평화를 생각하는 날" },
  { id: "constitution", name: "제헌절", month: 7, day: 17, anniversary_type: "other", memo: "대한민국 헌법을 기념하는 날" },
  { id: "chilseok", name: "칠석", yearlyDates: { 2026: "2026-08-19", 2027: "2027-08-08" }, anniversary_type: "love", memo: "견우와 직녀의 마음을 떠올리는 날" },
  { id: "liberation", name: "광복절", month: 8, day: 15, anniversary_type: "other", memo: "광복의 의미를 기억하는 날" },
  { id: "chuseok", name: "추석", yearlyDates: { 2026: "2026-09-25", 2027: "2027-09-14" }, anniversary_type: "family", memo: "가족과 풍요를 나누는 명절" },
  { id: "armed-forces", name: "국군의 날", month: 10, day: 1, anniversary_type: "other", memo: "헌신에 감사하는 날" },
  { id: "foundation", name: "개천절", month: 10, day: 3, anniversary_type: "other", memo: "하늘이 열린 날을 기념하세요" },
  { id: "hangul", name: "한글날", month: 10, day: 9, anniversary_type: "other", memo: "우리말과 글의 소중함을 나누는 날" },
  { id: "halloween", name: "핼러윈", month: 10, day: 31, anniversary_type: "friendship", memo: "가볍고 즐거운 안부를 전하세요" },
  { id: "pepero", name: "빼빼로데이", month: 11, day: 11, anniversary_type: "friendship", memo: "친구와 연인에게 마음을 전하세요" },
  { id: "farmers", name: "농업인의 날", month: 11, day: 11, anniversary_type: "thanks", memo: "수확과 먹거리에 감사하는 날" },
  { id: "martyrs", name: "순국선열의 날", month: 11, day: 17, anniversary_type: "other", memo: "헌신을 기억하는 날" },
  { id: "dongji", name: "동지", yearlyDates: { 2026: "2026-12-22", 2027: "2027-12-22" }, anniversary_type: "other", memo: "긴 밤을 지나 새 기운을 맞는 날" },
  { id: "christmas-eve", name: "크리스마스 이브", month: 12, day: 24, anniversary_type: "love", memo: "따뜻한 안부를 전하세요" },
  { id: "christmas", name: "성탄절", month: 12, day: 25, anniversary_type: "family", memo: "사랑과 평안을 전하세요" },
  { id: "year-end", name: "연말", month: 12, day: 31, anniversary_type: "thanks", memo: "한 해의 고마움을 전하세요" },
];

function toDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextSolarDate(month: number, day: number, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  let target = new Date(start.getFullYear(), month - 1, day);
  if (target.getTime() < start.getTime()) {
    target = new Date(start.getFullYear() + 1, month - 1, day);
  }
  return toDateString(target);
}

function getNextMappedDate(yearlyDates: Record<number, string>, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return Object.values(yearlyDates)
    .filter((date) => new Date(date).getTime() >= start.getTime())
    .sort()[0] ?? Object.values(yearlyDates).sort()[0];
}

function getDefaultAnniversaryDate(item: DefaultAnniversary) {
  if (item.yearlyDates && Object.keys(item.yearlyDates).length > 0) return getNextMappedDate(item.yearlyDates);
  if (typeof item.month !== "number" || typeof item.day !== "number") return null;
  return getNextSolarDate(item.month!, item.day!);
}

function getCalendarAnniversaryDate(item: DefaultAnniversary, year: number) {
  if (item.yearlyDates && Object.keys(item.yearlyDates).length > 0) {
    return item.yearlyDates[year] ?? Object.values(item.yearlyDates).find(Boolean) ?? null;
  }
  if (typeof item.month !== "number" || typeof item.day !== "number") return null;
  return `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
}

function getAnniversaryIcon(type: string) {
  if (type === "birthday") return <Cake size={30} />;
  if (type === "love") return <Heart size={30} fill="currentColor" />;
  if (type === "thanks") return <Heart size={30} />;
  if (type === "family") return <Flower2 size={30} />;
  return <CalendarDays size={30} />;
}

function useCommonAnniversaries() {
  const [items, setItems] = useState<DefaultAnniversary[]>(KOREAN_DEFAULT_ANNIVERSARIES);
  const [settings, setSettings] = useState<CommonAnniversarySetting>({ max_visible: 3, window_days: 7 });

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const [{ data: anniversariesData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("common_anniversaries")
          .select("id, name, month, day, yearly_dates, anniversary_type, memo, is_active, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("common_anniversary_settings")
          .select("max_visible, window_days")
          .eq("id", "home")
          .maybeSingle(),
      ]);

      if (!mounted) return;
      if (anniversariesData?.length) {
        setItems(anniversariesData.map((item) => ({
          id: item.id,
          name: item.name,
          month: item.month ?? undefined,
          day: item.day ?? undefined,
          yearlyDates: item.yearly_dates && Object.keys(item.yearly_dates).length > 0
            ? item.yearly_dates as Record<number, string>
            : undefined,
          anniversary_type: item.anniversary_type,
          memo: item.memo,
          is_active: item.is_active,
          sort_order: item.sort_order,
        })));
      }
      if (settingsData) {
        setSettings({
          max_visible: settingsData.max_visible,
          window_days: settingsData.window_days,
        });
      }
    };

    load().catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  return { items, settings };
}

export function HomeScreen() {
  const { cards } = useSupabaseCards();
  const { items: anniversaries } = useSupabaseAnniversaries();
  const { items: commonAnniversaries, settings: commonSettings } = useCommonAnniversaries();
  const { items: dbBackgrounds } = useDbBackgrounds();
  const { items: homeCards } = useHomeFeaturedCards();
  const { user, loading: authLoading } = useAuth();
  const [themeOpen, setThemeOpen] = useState(false);
  const [draft, , draftHydrated, resetDraft] = useDraft();
  const recentCards = cards.filter((c) => !c.id.startsWith("sample-")).slice(0, 4);
  const featuredCard = recentCards[0] ?? cards[0];
  const featuredHomeCard = homeCards[0] ?? null;
  const hasResumeDraft = draftHydrated && hasDraftProgress(draft);
  const resumeHref = getDraftResumeHref(draft);
  const homeBackground = dbBackgrounds.find((bg) => bg.category === "home") ?? dbBackgrounds[0];
  const upcomingItems = [
    ...anniversaries.map((item) => ({
      id: `user-${item.id}`,
      name: item.name,
      date: item.date,
      anniversary_type: item.anniversary_type,
      memo: item.memo ?? "직접 등록한 기념일",
      source: "user" as const,
    })),
    ...commonAnniversaries
      .map((item) => {
        const date = getDefaultAnniversaryDate(item);
        if (!date) return null;
        return {
          id: `default-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo,
          source: "default" as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  ]
    .map((item) => ({ ...item, dday: getDDay(item.date) }))
    .sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      if (ad !== bd) return ad - bd;
      return a.source === "user" ? -1 : 1;
    });
  const visibleUpcomingItems = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowMs = commonSettings.window_days * 24 * 60 * 60 * 1000;
    const inWindow = upcomingItems.filter((item) => {
      const diff = new Date(item.date).getTime() - today.getTime();
      return diff >= 0 && diff <= windowMs;
    });
    const selected = inWindow.length > 0 ? inWindow : upcomingItems.slice(0, 1);
    return selected.slice(0, commonSettings.max_visible);
  })();
  const displayName = user?.nickname ?? "마음님";
  const featuredMessage = featuredHomeCard?.message || featuredCard?.message || "오늘도 당신을 응원합니다";
  const featuredTitle = featuredHomeCard?.title || "오늘의 카드";
  const featuredCtaLabel = featuredHomeCard?.cta_label || "카드 만들기";
  const featuredLink = featuredHomeCard?.link_href || "/create/background";
  const featuredImageUrl = featuredHomeCard?.image_url || featuredCard?.cardImageUrl || homeBackground?.url || null;

  return (
    <PhoneShell hideHeader>
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur-md">
        <Link href="/" className="grid h-10 w-10 place-items-center" aria-label="홈">
          <ChevronLeft size={24} />
        </Link>
        <div className="text-center">
          <div className="text-lg font-black leading-none text-[#5a240d]">💞 마음카드</div>
          <div className="mt-1 text-[11px] font-semibold text-stone-600">마음을 전하는 감성 메시지</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="디자인 설정"
          >
            <Settings size={18} />
          </button>
          <Link href="/mypage" aria-label="마이페이지" className="grid h-9 w-9 place-items-center">
            {user ? (
              <Avatar url={user.avatarUrl} nickname={user.nickname} size={34} />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-stone-200 bg-stone-100 text-stone-400">
                <User size={18} />
              </div>
            )}
          </Link>
        </div>
      </header>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}

      {authLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-200 border-t-[#7b310d]" />
        </div>
      ) : (
      <div className="mx-auto max-w-5xl px-4 pt-5 pb-8 lg:px-6">
        {/* 인사말 */}
        <section className="mb-5 flex items-center gap-3">
          {user ? (
            <Avatar url={user.avatarUrl} nickname={user.nickname} size={44} />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-primary-container bg-surface-container-low text-primary">
              <User size={20} />
            </div>
          )}
          <div>
            <p className="text-[13px] font-semibold text-stone-500">안녕하세요,</p>
            <h2 className="text-lg font-black leading-tight text-stone-900">{displayName}님 <span className="text-primary">오늘도 따뜻한 하루!</span></h2>
          </div>
        </section>

        {hasResumeDraft && (
          <section className="mb-5 rounded-2xl border border-primary/20 bg-surface-container-low p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
                <Pencil size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-stone-900">작성 중인 카드가 있어요</p>
                <p className="mt-1 truncate text-xs font-semibold text-stone-500">
                  {draft.title?.trim() || draft.message.trim() || "이전에 고른 카드 설정을 이어서 완성해보세요."}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <Link
                href={resumeHref}
                className="flex h-11 items-center justify-center rounded-xl bg-[#7b310d] text-sm font-black text-white transition active:scale-[0.98]"
              >
                이어서 만들기
              </Link>
              <button
                type="button"
                onClick={resetDraft}
                className="h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-500 transition hover:bg-stone-50 active:scale-[0.98]"
              >
                새로
              </button>
            </div>
          </section>
        )}

        {/* 다가오는 기념일 */}
        {visibleUpcomingItems.length > 0 && (
          <section className="mb-5">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-700">다가오는 기념일</h3>
              <Link href="/anniversaries" className="flex items-center text-xs font-semibold text-stone-400 hover:text-stone-600">
                더보기 <ChevronRight size={14} />
              </Link>
            </div>
            <div className="space-y-2">
              {visibleUpcomingItems.map((item, index) => (
                <Link
                  key={item.id}
                  href="/anniversaries"
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 hover:scale-[1.015] active:scale-[0.99] hover:brightness-95 ${
                    index === 0 ? "bg-surface-container" : "border border-outline-variant/20 bg-surface-container-low"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    item.source === "user"
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-secondary-container text-on-secondary-container"
                  }`}>
                    {getAnniversaryIcon(item.anniversary_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <h4 className="min-w-0 truncate text-sm font-bold text-stone-800">{item.name}</h4>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        index === 0 ? "bg-primary text-on-primary" : "bg-stone-100 text-stone-500"
                      }`}>
                        {item.dday}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-400">{item.memo}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-start">
          {/* 대표 카드 */}
          <section>
            <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <div className="relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-container">
                {featuredImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featuredImageUrl} alt={featuredHomeCard?.title ?? "추천 마음카드"} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="relative h-full w-full bg-gradient-to-br from-primary-fixed via-surface-container-lowest to-secondary-fixed">
                    <div className="absolute left-5 top-6 text-primary/25">
                      <Flower2 size={86} />
                    </div>
                    <div className="absolute bottom-8 right-5 text-primary/20">
                      <Flower2 size={118} />
                    </div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.75),transparent_42%)]" />
                  </div>
                )}
                {(featuredHomeCard?.show_title !== false || featuredHomeCard?.show_text !== false) && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="px-4 text-center">
                      {featuredHomeCard?.show_title !== false && featuredTitle && (
                        <span className="mb-2 inline-flex rounded-full bg-white/45 px-3 py-1 text-[11px] font-bold text-on-background backdrop-blur-sm">
                          {featuredTitle}
                        </span>
                      )}
                      {featuredHomeCard?.show_text !== false && featuredMessage && (
                        <span className="block rounded-lg bg-white/45 px-4 py-2 font-headline-lg text-headline-lg text-on-background backdrop-blur-sm">
                          {featuredMessage.length > 34 ? `${featuredMessage.slice(0, 34)}...` : featuredMessage} ♡
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {featuredImageUrl && (
                <div className="mb-3 flex w-full gap-2">
                  <button
                    onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.share) {
                        try {
                          await navigator.share({ url: featuredImageUrl, title: featuredTitle });
                        } catch {
                          // user cancelled or not supported
                        }
                      } else {
                        await navigator.clipboard.writeText(featuredImageUrl).catch(() => {});
                        window.alert("이미지 링크가 복사되었습니다.");
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-[0.98]"
                  >
                    <Share2 size={15} />
                    공유하기
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(featuredImageUrl);
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `마음카드_${featuredTitle}_${Date.now()}.jpg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        window.open(featuredImageUrl, "_blank");
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-[0.98]"
                  >
                    <Download size={15} />
                    저장하기
                  </button>
                </div>
              )}
              <Link
                href={featuredLink}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#7b310d] text-base font-black text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
              >
                <Pencil size={19} />
                {featuredCtaLabel}
              </Link>
            </div>
          </section>

          <div className="space-y-4">
            {/* 오늘의 추천 문구 */}
            <section>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-700">오늘의 추천 문구</h3>
                <Link href="/create/message" className="flex items-center text-xs font-semibold text-stone-400 hover:text-stone-600">
                  더보기 <ChevronRight size={14} />
                </Link>
              </div>
              <Link
                href="/create/message"
                className="relative block overflow-hidden rounded-xl border border-stone-100 bg-stone-50 px-5 py-4 text-center transition hover:bg-stone-100"
              >
                <Quote className="absolute left-2 top-2 scale-150 text-[#7b310d]/15" size={22} />
                <p className="text-sm font-semibold leading-relaxed text-stone-600">
                  가장 아름다운 시간은 바로 지금,<br />당신과 함께하는 오늘입니다.
                </p>
                <Heart className="absolute bottom-3 right-3 text-[#7b310d]/50" size={18} />
              </Link>
            </section>

            {/* 빠른 이동 */}
            <section className="grid grid-cols-2 gap-3">
              <Link href="/library" className="flex h-[120px] flex-col justify-between rounded-2xl bg-amber-50 p-4 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:brightness-95">
                <Inbox className="text-[#7b310d]" size={26} />
                <div>
                  <p className="text-sm font-black text-stone-800">보관함</p>
                  <p className="text-[11px] font-semibold text-stone-400">받은 카드 확인하기</p>
                </div>
              </Link>
              <Link href="/create/message?length=hand&purpose=hand" className="flex h-[120px] flex-col justify-between rounded-2xl bg-violet-50 p-4 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:brightness-95">
                <Sparkles className="text-violet-600" size={26} />
                <div>
                  <p className="text-sm font-black text-stone-800">손편지 쓰기</p>
                  <p className="text-[11px] font-semibold text-stone-400">AI와 함께 손편지 진심 만들기</p>
                </div>
              </Link>
            </section>
          </div>
        </div>
      </div>
      )}
    </PhoneShell>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#7b310d] text-xs text-white">{n}</span>
      {children}
    </div>
  );
}

type MsgLength = "short" | "long" | "hand";
type ShortMode = "recommend" | "direct" | "ai";
type LongMode = "long_recommend" | "direct" | "long_ai";
type HandMode = "hand_recommend" | "direct" | "hand_ai";

export function MessageScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDirect = searchParams.get("mode") === "direct";
  const initialLength = searchParams.get("length");
  const requestedPurpose = searchParams.get("purpose");
  const [draft, setDraft] = useDraft();
  const { isSaved: isFavSaved, toggle: toggleFavMsg } = useFavMessages();
  const [length, setLength] = useState<MsgLength>(initialLength === "long" || initialLength === "hand" ? initialLength : "short");
  const [shortMode, setShortMode] = useState<ShortMode>(isDirect ? "direct" : "recommend");
  const [longMode, setLongMode] = useState<LongMode>(isDirect ? "direct" : "long_recommend");
  const [handMode, setHandMode] = useState<HandMode>(isDirect ? "direct" : "hand_recommend");
  const [decoOpen, setDecoOpen] = useState(false);
  const aiEnabled = useAiEnabled();
  const uiSettings = usePublicUiSettings();
  const handMessageMaxLength = handMessageMaxLengthByTone.general;
  const handMessages = handMessagesByTone.general;
  const enabledHandFontOptions = handFontOptions.filter((option) => {
    if (option.id === "round") return uiSettings.hand_font_round_enabled;
    if (option.id === "brush") return uiSettings.hand_font_brush_enabled;
    return uiSettings.hand_font_pen_enabled;
  });
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFallback, setAiFallback] = useState(false);

  const [longAiMessages, setLongAiMessages] = useState<string[]>([]);
  const [longAiLoading, setLongAiLoading] = useState(false);
  const [longAiError, setLongAiError] = useState<string | null>(null);

  const [correcting, setCorrecting] = useState(false);
  const [correctedText, setCorrectedText] = useState<string | null>(null);
  const [correctError, setCorrectError] = useState<string | null>(null);

  const selectedPurpose = draft.purpose || "love";
  const [recommendCategory, setRecommendCategory] = useState<RecommendationCategory>(
    selectedPurpose === "hand" ? "all" : (selectedPurpose as RecommendationCategory),
  );
  const shortRecommendGroups = getRecommendedGroups(messagesByPurpose, recommendCategory);
  const longRecommendGroups = getRecommendedGroups(longMessagesByPurpose, recommendCategory);
  const canGoNext = draft.message.trim().length > 0;

  const isDirectMode =
    (length === "short" && shortMode === "direct") ||
    (length === "long" && longMode === "direct") ||
    (length === "hand" && handMode === "direct");

  const fetchAiMessages = useCallback(async (isLong: boolean) => {
    if (isLong) { setLongAiLoading(true); setLongAiError(null); }
    else { setAiLoading(true); setAiError(null); setAiFallback(false); }
    try {
      const res = await fetch("/api/ai-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: selectedPurpose, recipient: draft.name, honorific: draft.honorific, long: isLong }),
      });
      const data = await res.json().catch(() => ({})) as { messages?: string[]; fallback?: boolean; error?: string };
      if (!res.ok || !data.messages?.length) throw new Error(data.error ?? "AI 문구 생성에 실패했습니다.");
      if (isLong) setLongAiMessages(data.messages);
      else { setAiMessages(data.messages); setAiFallback(Boolean(data.fallback)); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI 문구 생성에 실패했습니다.";
      if (isLong) setLongAiError(msg);
      else setAiError(msg);
    } finally {
      if (isLong) setLongAiLoading(false);
      else setAiLoading(false);
    }
  }, [draft.honorific, draft.name, selectedPurpose]);

  useEffect(() => {
    setAiMessages([]); setAiError(null); setAiFallback(false);
    setLongAiMessages([]); setLongAiError(null);
  }, [draft.honorific, draft.name, selectedPurpose]);

  useEffect(() => {
    if (!honorificOptions.includes(draft.honorific)) {
      setDraft({ honorific: "에게" });
    }
  }, [draft.honorific, setDraft]);

  useEffect(() => {
    if (length !== "hand") return;
    if (!enabledHandFontOptions.length) return;
    if (enabledHandFontOptions.some((option) => option.id === draft.handFont)) return;
    setDraft({ handFont: enabledHandFontOptions[0].id });
  }, [draft.handFont, enabledHandFontOptions, length, setDraft]);

  useEffect(() => {
    if (requestedPurpose === "custom" && draft.purpose !== "custom") {
      setDraft({ purpose: "custom" });
    }
    if (requestedPurpose === "hand" && draft.purpose !== "hand") {
      setDraft({ purpose: "hand", handTone: "general", honorific: "에게", handMode: "recommend", titleFont: "nanumgothic", contentFont: "nanumgothic" });
    }
  }, [draft.purpose, requestedPurpose, setDraft]);

  const fetchAiCorrect = useCallback(async () => {
    if (!draft.message.trim() || correcting) return;
    setCorrecting(true);
    setCorrectError(null);
    setCorrectedText(null);
    try {
      const res = await fetch("/api/ai-correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.message }),
      });
      const data = await res.json() as { corrected?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "교정 실패");
      setCorrectedText(data.corrected ?? null);
    } catch (err) {
      setCorrectError(err instanceof Error ? err.message : "AI 교정 실패");
    } finally {
      setCorrecting(false);
    }
  }, [correcting, draft.message]);

  return (
    <PhoneShell backHref="/create/background">
      <div className="space-y-5">
        <div>
          <StepLabel n={1}>전하고 싶은 글귀를 선택하거나 입력해주세요.</StepLabel>

          {/* 단문 / 장문 / 손편지 토글 */}
          <div className="mt-3 flex rounded-lg bg-stone-100 p-0.5">
            {(["short", "long", "hand"] as MsgLength[]).map((l) => (
              <button
                key={l}
                onClick={() => {
                  if (l !== length) {
                    setLength(l);
                    setDraft(l === "hand" ? { message: "", handTone: "general", honorific: "에게", handMode: "recommend", titleFont: "nanumgothic", contentFont: "nanumgothic" } : { message: "" });
                    if (l === "hand") setHandMode("hand_recommend");
                    else if (l === "short") setShortMode("recommend");
                    else setLongMode("long_recommend");
                  }
                }}
                className={`flex-1 h-9 rounded-md text-sm font-bold transition-all ${length === l ? "bg-[#7b310d] text-white shadow" : "text-stone-500"}`}
              >
                {l === "short" ? "단문" : l === "long" ? "✍️ 장문 캘리그래피" : "💌 손편지"}
              </button>
            ))}
          </div>

          {/* 단문 모드 탭 */}
          {length === "short" && (
            <div className={`mt-2 grid gap-2 ${aiEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
              {(["recommend", "direct", ...(aiEnabled ? ["ai"] : [])] as ShortMode[]).map((m) => (
                <button key={m} onClick={() => setShortMode(m)}
                  className={`h-10 rounded-md border text-sm font-bold ${shortMode === m ? "border-[#d98238] bg-orange-50 text-[#7b310d]" : "border-stone-200"}`}>
                  {m === "recommend" ? "추천 글귀" : m === "direct" ? "직접 입력" : "AI 추천"}
                </button>
              ))}
            </div>
          )}

          {/* 장문 모드 탭 */}
          {length === "long" && (
            <div className={`mt-2 grid gap-2 ${aiEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
              {(["long_recommend", "direct", ...(aiEnabled ? ["long_ai"] : [])] as LongMode[]).map((m) => (
                <button key={m} onClick={() => setLongMode(m)}
                  className={`h-10 rounded-md border text-sm font-bold ${longMode === m ? "border-[#d98238] bg-orange-50 text-[#7b310d]" : "border-stone-200"}`}>
                  {m === "long_recommend" ? "장문 추천" : m === "direct" ? "직접 입력" : "장문 AI"}
                </button>
              ))}
            </div>
          )}

          {/* 손편지 모드 탭 */}
          {length === "hand" && (
            <div className="mt-2 space-y-2">
              <div className="grid gap-2 grid-cols-2">
                {(["hand_recommend", "direct"] as HandMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setHandMode(m);
                      setDraft({ handMode: m === "direct" ? "direct" : "recommend" });
                    }}
                    className={`h-10 rounded-md border text-sm font-bold ${handMode === m ? "border-[#d98238] bg-orange-50 text-[#7b310d]" : "border-stone-200"}`}>
                    {m === "hand_recommend" ? "손편지 추천" : "직접 입력"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {length === "hand" && (
            <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold leading-6 text-stone-500">
              손편지는 하나의 흐름으로 제공됩니다. 추천 문구를 고르거나 바로 입력해보세요.
            </div>
          )}

          {/* 직접 입력 */}
          {isDirectMode ? (
            <div className="mt-3 space-y-3">
              <textarea
                value={draft.message}
                onChange={(e) => {
                  const nextValue = e.target.value.slice(0, handMessageMaxLength);
                  setDraft({ message: nextValue });
                  setCorrectedText(null);
                }}
                placeholder={length === "hand"
                  ? "마음을 담아 손편지처럼 길게 써보세요."
                  : length === "long"
                    ? "마음을 담아 편지를 써보세요. (장문)"
                    : "마음을 담은 문구를 입력해주세요."}
                maxLength={length === "hand" ? handMessageMaxLength : undefined}
                className={`w-full rounded-md border border-stone-200 p-4 leading-7 outline-none focus:border-[#7b310d] ${length === "hand" || length === "long" ? "min-h-52" : "min-h-40"}`}
                style={length === "hand" ? { fontFamily: HAND_GOTHIC_FONT, fontSize: `${uiSettings.hand_compose_font_size}px` } : undefined}
              />
              {length === "hand" && (
                <p className={`text-right text-xs font-semibold ${draft.message.length > handMessageMaxLength * 0.9 ? "text-[#7b310d]" : "text-stone-400"}`}>
                  {draft.message.length}/{handMessageMaxLength}
                </p>
              )}
              {(length === "long" || length === "hand") && draft.message.trim().length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                  <button
                    onClick={fetchAiCorrect}
                    disabled={correcting}
                    className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-600 to-[#7b310d] text-sm font-bold text-white disabled:opacity-60"
                  >
                    {correcting ? "✨ AI 교정 중..." : "✨ AI 맞춤법 · 감성 교정 (1C)"}
                  </button>
                  {correctError && <p className="mt-2 text-xs font-semibold text-red-600">{correctError}</p>}
                  {correctedText && (
                    <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3">
                      <p className="mb-1 text-xs font-bold text-violet-600">AI 교정 결과 미리보기</p>
                      <p className="whitespace-pre-line text-sm leading-7 text-stone-800">{correctedText}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => { setDraft({ message: correctedText }); setCorrectedText(null); }}
                          className="flex-1 rounded-md bg-violet-600 py-2 text-xs font-bold text-white"
                        >
                          교정본 적용
                        </button>
                        <button
                          onClick={() => setCorrectedText(null)}
                          className="rounded-md border border-stone-200 px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-50"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2">

              {/* 단문 AI 버튼 */}
              {length === "short" && shortMode === "ai" && (
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                  <button onClick={() => fetchAiMessages(false)} disabled={aiLoading}
                    className="h-11 w-full rounded-lg bg-[#7b310d] text-sm font-bold text-white disabled:bg-stone-300">
                    {aiLoading ? "AI가 문구를 만드는 중..." : aiMessages.length > 0 ? "다시 만들기" : "AI 문구 만들기"}
                  </button>
                  {aiFallback && <p className="mt-2 text-xs font-semibold text-stone-500">AI 연결이 불안정해 기본 추천 문구를 보여드렸어요.</p>}
                  {aiError && <p className="mt-2 text-xs font-semibold text-red-600">{aiError}</p>}
                </div>
              )}
              {length === "short" && shortMode === "ai" && !aiLoading && aiMessages.length === 0 && (
                <div className="rounded-md border border-dashed border-stone-200 px-4 py-8 text-center text-sm font-semibold text-stone-500">버튼을 눌러 맞춤 문구를 생성하세요.</div>
              )}

              {/* 장문 AI 버튼 */}
              {length === "long" && longMode === "long_ai" && (
                <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                  <button onClick={() => fetchAiMessages(true)} disabled={longAiLoading}
                    className="h-11 w-full rounded-lg bg-[#7b310d] text-sm font-bold text-white disabled:bg-stone-300">
                    {longAiLoading ? "AI가 장문을 만드는 중..." : longAiMessages.length > 0 ? "다시 만들기" : "AI 장문 만들기"}
                  </button>
                  {longAiError && <p className="mt-2 text-xs font-semibold text-red-600">{longAiError}</p>}
                </div>
              )}
              {length === "long" && longMode === "long_ai" && !longAiLoading && longAiMessages.length === 0 && (
                <div className="rounded-md border border-dashed border-stone-200 px-4 py-8 text-center text-sm font-semibold text-stone-500">버튼을 눌러 맞춤 장문을 생성하세요.</div>
              )}

              {/* 단문 메시지 목록 */}
              {length === "short" && shortMode === "recommend" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendationCategoryOrder.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setRecommendCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        recommendCategory === category ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {recommendationCategoryLabels[category]}
                    </button>
                  ))}
                </div>
              )}

              {length === "short" && shortMode === "recommend" && (
                <div className="mt-4 space-y-4">
                  {shortRecommendGroups.map((group) => (
                    <div key={group.purpose}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">{group.label}</h4>
                        <span className="text-[11px] font-semibold text-stone-400">{group.messages.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {group.messages.map((msg) => (
                          <div key={msg} className={`flex items-center gap-2 rounded-md border ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200"}`}>
                            <button onClick={() => setDraft({ message: msg })} className="flex flex-1 items-center gap-2 p-3 text-left text-sm leading-6">
                              <Heart size={16} className={`shrink-0 ${draft.message === msg ? "fill-[#d98238] text-[#d98238]" : "text-stone-300"}`} />
                              <span>{msg}</span>
                            </button>
                            <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="shrink-0 p-3" aria-label="즐겨찾기">
                              <Bookmark size={16} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : "text-stone-300"} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {length === "short" && shortMode === "ai" && aiMessages.length > 0 && (
                <div className="space-y-2">
                  {aiMessages.map((msg) => (
                    <div key={msg} className={`flex items-center gap-2 rounded-md border ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200"}`}>
                      <button onClick={() => setDraft({ message: msg })} className="flex flex-1 items-center gap-2 p-3 text-left text-sm leading-6">
                        <Heart size={16} className={`shrink-0 ${draft.message === msg ? "fill-[#d98238] text-[#d98238]" : "text-stone-300"}`} />
                        <span>{msg}</span>
                      </button>
                      <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="shrink-0 p-3" aria-label="즐겨찾기">
                        <Bookmark size={16} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : "text-stone-300"} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 장문 메시지 목록 */}
              {length === "long" && longMode === "long_recommend" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recommendationCategoryOrder.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setRecommendCategory(category)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                        recommendCategory === category ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {recommendationCategoryLabels[category]}
                    </button>
                  ))}
                </div>
              )}

              {length === "long" && longMode === "long_recommend" && (
                <div className="mt-4 space-y-4">
                  {longRecommendGroups.map((group) => (
                    <div key={group.purpose}>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">{group.label}</h4>
                        <span className="text-[11px] font-semibold text-stone-400">{group.messages.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {group.messages.map((msg) => (
                          <div key={msg} className={`rounded-xl border p-4 ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200 bg-white"}`}>
                            <p className="whitespace-pre-line text-sm leading-7 text-stone-700">{msg}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="flex items-center gap-1 text-xs font-bold text-stone-400" aria-label="즐겨찾기">
                                <Bookmark size={13} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : ""} />
                                {isFavSaved(msg) ? "저장됨" : "저장"}
                              </button>
                              <button
                                onClick={() => setDraft({ message: msg })}
                                className={`rounded-md px-4 py-1.5 text-xs font-bold ${draft.message === msg ? "bg-[#7b310d] text-white" : "border border-[#7b310d] text-[#7b310d]"}`}
                              >
                                {draft.message === msg ? "선택됨 ✓" : "이 글로 카드 만들기"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {length === "long" && longMode === "long_ai" && longAiMessages.length > 0 && (
                <div className="mt-4 space-y-2">
                  {longAiMessages.map((msg) => (
                    <div key={msg} className={`rounded-xl border p-4 ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200 bg-white"}`}>
                      <p className="whitespace-pre-line text-sm leading-7 text-stone-700">{msg}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="flex items-center gap-1 text-xs font-bold text-stone-400" aria-label="즐겨찾기">
                          <Bookmark size={13} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : ""} />
                          {isFavSaved(msg) ? "저장됨" : "저장"}
                        </button>
                        <button
                          onClick={() => setDraft({ message: msg })}
                          className={`rounded-md px-4 py-1.5 text-xs font-bold ${draft.message === msg ? "bg-[#7b310d] text-white" : "border border-[#7b310d] text-[#7b310d]"}`}
                        >
                          {draft.message === msg ? "선택됨 ✓" : "이 글로 카드 만들기"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 손편지 메시지 목록 */}
              {length === "hand" && (handMode === "hand_recommend" || handMode === "direct") &&
                handMessages.map((msg) => (
                  <div key={msg} className={`rounded-xl border p-4 ${draft.message === msg ? "border-[#d98238] bg-orange-50" : "border-stone-200 bg-white"}`}>
                    <p className="whitespace-pre-line text-sm leading-7 text-stone-700" style={{ fontFamily: HAND_GOTHIC_FONT, fontSize: `${uiSettings.hand_compose_font_size}px` }}>
                      {msg}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => toggleFavMsg(msg, selectedPurpose)} className="flex items-center gap-1 text-xs font-bold text-stone-400" aria-label="즐겨찾기">
                        <Bookmark size={13} className={isFavSaved(msg) ? "fill-[#7b310d] text-[#7b310d]" : ""} />
                        {isFavSaved(msg) ? "저장됨" : "저장"}
                      </button>
                      <button
                        onClick={() => setDraft({ message: msg })}
                        className={`rounded-md px-4 py-1.5 text-xs font-bold ${draft.message === msg ? "bg-[#7b310d] text-white" : "border border-[#7b310d] text-[#7b310d]"}`}
                      >
                        {draft.message === msg ? "선택됨 ✓" : "이 편지로 카드 만들기"}
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* 카드 꾸미기 — 제목·하단메세지·작성자를 하나의 접이식 패널로 통합 (선택) */}
        {(() => {
          const decoCount =
            (draft.title?.trim() ? 1 : 0) +
            (draft.footer?.trim() ? 1 : 0) +
            (draft.authorEnabled && draft.author?.trim() ? 1 : 0);
          return (
            <div className="rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setDecoOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <StepLabel n={2}>카드 꾸미기 <span className="font-normal text-stone-400">(선택)</span></StepLabel>
                  {decoCount > 0 && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-[#7b310d]">{decoCount}개 설정됨</span>
                  )}
                </div>
                <ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform duration-200 ${decoOpen ? "rotate-180" : ""}`} />
              </button>

              {decoOpen && (
                <div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">
                  {/* 카드 제목 */}
                  <div>
                    <label className="text-xs font-bold text-stone-500">카드 제목 <span className="font-normal text-stone-400">· 상단 큰 글씨</span></label>
                    <input
                      type="text"
                      value={draft.title ?? ""}
                      onChange={(e) => setDraft({ title: e.target.value })}
                      placeholder="예: 고마워요, 생일 축하해, 사랑합니다"
                      maxLength={20}
                      className="mt-1.5 h-11 w-full rounded-lg border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
                    />
                  </div>
                  {/* 하단 메세지 */}
                  <div>
                    <label className="text-xs font-bold text-stone-500">하단 메세지 <span className="font-normal text-stone-400">· 내용 아래 작게</span></label>
                    <input
                      type="text"
                      value={draft.footer ?? ""}
                      onChange={(e) => setDraft({ footer: e.target.value })}
                      placeholder="예: 늘 고맙습니다 · 2026.06.11"
                      maxLength={40}
                      className="mt-1.5 h-11 w-full rounded-lg border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
                    />
                  </div>
                  {/* 작성자 */}
                  <div>
                    <label className="flex cursor-pointer items-center justify-between">
                      <span className="text-xs font-bold text-stone-500">작성자 표시 <span className="font-normal text-stone-400">· 보내는 사람</span></span>
                      <input
                        type="checkbox"
                        checked={draft.authorEnabled ?? false}
                        onChange={(e) => setDraft({ authorEnabled: e.target.checked })}
                        className="h-4 w-4 accent-[#7b310d]"
                      />
                    </label>
                    {draft.authorEnabled && (
                      <input
                        type="text"
                        value={draft.author ?? ""}
                        onChange={(e) => setDraft({ author: e.target.value })}
                        placeholder="보내는 사람 (예: 문주)"
                        maxLength={20}
                        className="mt-2 h-11 w-full rounded-lg border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-stone-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {!canGoNext && (
            <p className="mb-1 text-center text-xs font-semibold text-stone-400">
              글귀를 선택하거나 입력해 주세요
            </p>
          )}
          <PrimaryButton disabled={!canGoNext} onClick={() => router.push("/create/preview")}>카드 만들기</PrimaryButton>
          {uiSettings.ai_compose_enabled && (
            <button
              disabled={!canGoNext}
              onClick={() => router.push("/create/preview?ai=1")}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[#7b310d] bg-white px-4 py-3 text-center font-bold text-[#7b310d] transition active:scale-[0.99] disabled:border-stone-200 disabled:text-stone-300"
            >
              <Sparkles size={18} /> AI로 만들기
            </button>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}

type DbBackground = {
  id: string;
  name: string;
  category: string;
  url: string;
  is_active: boolean;
};

type HomeFeaturedCard = {
  id: string;
  title: string;
  message: string;
  image_url: string;
  link_href: string;
  cta_label: string;
  is_active: boolean;
  show_title: boolean;
  show_text: boolean;
  sort_order: number;
};

function useDbBackgrounds() {
  const [items, setItems] = useState<DbBackground[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("backgrounds")
        .select("id, name, category, url, is_active, sort_order, created_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (mounted) {
        setItems((data ?? []) as DbBackground[]);
        setFetching(false);
      }
    };

    load().catch(() => {
      if (mounted) setFetching(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { items, fetching };
}

function useHomeFeaturedCards() {
  const [items, setItems] = useState<HomeFeaturedCard[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const load = async () => {
      const { data } = await supabase
        .from("home_featured_cards")
        .select("id, title, message, image_url, link_href, cta_label, is_active, show_title, show_text, sort_order, created_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (mounted) {
        setItems((data ?? []) as HomeFeaturedCard[]);
        setFetching(false);
      }
    };

    load().catch(() => {
      if (mounted) setFetching(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { items, fetching };
}

const BG_CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "home", label: "🏠 홈 대표" },
  { id: "nature", label: "🌿 자연" },
  { id: "season", label: "🌸 계절" },
  { id: "emotion", label: "💞 감성" },
  { id: "city", label: "🏙️ 도시" },
  { id: "abstract", label: "✨ 추상" },
  { id: "pattern", label: "🎨 패턴" },
];

type WsRegion = {
  cx: number; cy: number; x0: number; y0: number; x1: number; y1: number;
  band: "top" | "center" | "bottom";
  density: number; emptiness: number; wRatio: number; hRatio: number;
};

export function BackgroundScreen() {
  const router = useRouter();
  const [draft, setDraft] = useDraft();
  const uiSettings = usePublicUiSettings();
  const [tab, setTab] = useState<"gallery" | "basic" | "ai">("gallery");
  const [catFilter, setCatFilter] = useState("all");
  const [aiPrompt, setAiPrompt] = useState("");
  const { loading: aiLoading, progress: aiProgress, url: aiUrl, error: aiError, generate: aiGenerate, reset: aiReset } = useAIBackground();
  const { items: dbBgs, fetching } = useDbBackgrounds();

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    aiGenerate(aiPrompt.trim(), {
      purpose: draft.purpose || "love",
      promptCode: draft.purpose === "birthday" ? "BIRTHDAY_FLOWER_WARM" : undefined,
      recipient: draft.name,
      honorific: draft.honorific,
      message: draft.message,
    });
  };

  // 빈영역 탐지 테스트
  const [wsRegion, setWsRegion] = useState<WsRegion | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsMeta, setWsMeta] = useState<{ band: string; ms: number; emptiness: number; wRatio: number; hRatio: number } | null>(null);

  useEffect(() => { setWsRegion(null); setWsMeta(null); }, [draft.bg]);

  const runWhitespaceTest = async () => {
    if (!draft.bg) return;
    setWsLoading(true);
    setWsRegion(null);
    try {
      const res = await fetch("/api/whitespace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bg: draft.bg }),
      });
      const data = (await res.json()) as { region?: WsRegion; ms?: number };
      if (data.region) {
        setWsRegion(data.region);
        setWsMeta({
          band: data.region.band,
          ms: data.ms ?? 0,
          emptiness: data.region.emptiness,
          wRatio: data.region.wRatio,
          hRatio: data.region.hRatio,
        });
      }
    } catch {
      // 무시 (테스트용)
    } finally {
      setWsLoading(false);
    }
  };

  const wsPreviewSrc = draft.bg?.startsWith("ai:")
    ? draft.bg.slice(3)
    : draft.bg?.startsWith("http") || draft.bg?.startsWith("data:")
      ? draft.bg
      : null;
  const wsPreviewSwatch = wsPreviewSrc ? null : backgrounds.find((b) => b.id === draft.bg)?.swatch;

  // 재정렬 흐름: 배경 → 글귀. 목적/직접입력 의도를 파라미터로 전달.
  const messageHref = (() => {
    const params = new URLSearchParams();
    if (draft.purpose === "hand") params.set("length", "hand");
    if (draft.directMode) params.set("mode", "direct");
    if (draft.purpose === "custom") params.set("purpose", "custom");
    const qs = params.toString();
    return qs ? `/create/message?${qs}` : "/create/message";
  })();

  return (
    <PhoneShell backHref="/home">
      <h1 className="text-center text-2xl font-black leading-9">마음에 드는 배경을<br />선택해주세요.</h1>
      {/* 재정렬 흐름: 배경(1단계) */}

      {/* 탭 */}
      <div className={`mt-5 grid gap-1 rounded-xl bg-stone-100 p-1 ${uiSettings.ai_background_enabled ? "grid-cols-3" : "grid-cols-2"}`}>
        {(uiSettings.ai_background_enabled
          ? ([["gallery", "배경 갤러리"], ["basic", "기본 배경"], ["ai", "✨ AI 생성"]] as const)
          : ([["gallery", "배경 갤러리"], ["basic", "기본 배경"]] as const)
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`h-10 rounded-lg text-xs font-bold transition ${tab === key ? "bg-[#7b310d] text-white shadow" : "text-stone-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 저장된 배경 갤러리 */}
      {tab === "gallery" && (
        fetching ? (
          <div className="mt-6 flex justify-center py-12 text-stone-400">
            <div className="grid h-10 w-10 place-items-center rounded-full border-4 border-stone-200 border-t-[#7b310d] animate-spin" />
          </div>
        ) : dbBgs.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-stone-300 py-12 text-stone-400">
            <p className="font-semibold text-sm">저장된 배경이 없어요.</p>
            <p className="text-xs">관리자 페이지에서 배경을 먼저 생성해주세요.</p>
            <a href="/admin/backgrounds" className="mt-1 rounded-lg bg-[#7b310d] px-4 py-2 text-xs font-bold text-white">
              배경 관리 →
            </a>
          </div>
        ) : (
          <>
            {/* 카테고리 필터 */}
            {(() => {
              const usedCats = new Set(dbBgs.map((b) => b.category));
              const visibleCats = BG_CATEGORIES.filter((c) => c.id === "all" || usedCats.has(c.id));
              return visibleCats.length > 1 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {visibleCats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCatFilter(c.id)}
                      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${catFilter === c.id ? "bg-[#7b310d] text-white" : "bg-stone-100 text-stone-600"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="mt-3 grid grid-cols-3 gap-2">
              {dbBgs
                .filter((bg) => catFilter === "all" || bg.category === catFilter)
                .map((bg) => {
                  const selected = draft.bg === bg.url;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => setDraft({ bg: bg.url })}
                      className={`relative aspect-[3/4] overflow-hidden rounded-xl ${selected ? "ring-4 ring-[#7b310d]" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bg.url} alt={bg.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2">
                        <p className="text-[10px] font-bold text-white truncate">{bg.name}</p>
                      </div>
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#7b310d] text-white">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </>
        )
      )}

      {/* 기본 그라디언트 배경 */}
      {tab === "basic" && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setDraft({ bg: bg.id })}
              className={`relative grid aspect-[3/4] place-items-center rounded-xl bg-gradient-to-br ${bg.swatch} text-4xl ${draft.bg === bg.id ? "ring-4 ring-[#7b310d]" : ""}`}
            >
              {bg.mark}
              {draft.bg === bg.id && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#7b310d] text-white">
                  <Check size={13} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* AI 생성 */}
      {tab === "ai" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-stone-600">
            원하는 배경 분위기를 입력하면 카드 문구와 받는 분에 맞춰 감성 배경을 만들어드려요. (크레딧 1개 소모)
          </p>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="예: 봄 벚꽃, 따뜻한 석양, 잔잔한 바다..."
              className="flex-1 h-12 rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-[#7b310d]"
              onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
            />
            <button
              onClick={handleAiGenerate}
              disabled={!aiPrompt.trim() || aiLoading}
              className="h-12 shrink-0 rounded-xl bg-[#7b310d] px-4 text-sm font-bold text-white disabled:bg-stone-300"
            >
              생성
            </button>
          </div>

          {aiLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="grid h-24 w-24 place-items-center rounded-full border-[8px] border-purple-200 border-t-[#6f3cc3] text-xl font-black text-[#6f3cc3]">
                {aiProgress}%
              </div>
              <p className="text-sm font-bold text-stone-600">AI가 문구가 잘 어울리는 배경을 만들고 있어요...</p>
            </div>
          )}

          {aiError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {aiError}
              <button onClick={aiReset} className="ml-2 underline">다시 시도</button>
            </div>
          )}

          {aiUrl && !aiLoading && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={aiUrl} alt="AI 생성 배경" className="h-full w-full object-cover" />
                {draft.bg === `ai:${aiUrl}` && (
                  <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#7b310d] text-white">
                    <Check size={16} />
                  </div>
                )}
              </div>
              <button
                onClick={() => setDraft({ bg: `ai:${aiUrl}` })}
                className={`w-full h-11 rounded-xl border font-bold text-sm ${draft.bg === `ai:${aiUrl}` ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200"}`}
              >
                {draft.bg === `ai:${aiUrl}` ? "✓ 선택됨" : "이 배경 사용하기"}
              </button>
              <button onClick={() => { aiReset(); setAiPrompt(""); }} className="w-full h-10 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600">
                다시 생성하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 빈영역 탐지 테스트 */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-600">🔍 빈영역 탐지 테스트</span>
          <button
            onClick={runWhitespaceTest}
            disabled={!draft.bg || wsLoading}
            className="rounded-lg bg-[#7b310d] px-3 py-1.5 text-xs font-bold text-white disabled:bg-stone-300"
          >
            {wsLoading ? "탐지 중..." : "탐지 실행"}
          </button>
        </div>
        {!draft.bg && <p className="mt-2 text-xs text-stone-400">먼저 배경을 선택하세요.</p>}
        {(wsPreviewSrc || wsPreviewSwatch) && (
          <div className="relative mx-auto mt-3 aspect-[2/3] w-44 overflow-hidden rounded-lg ring-1 ring-stone-200">
            {wsPreviewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wsPreviewSrc} alt="배경 미리보기" className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${wsPreviewSwatch}`} />
            )}
            {wsRegion && (
              <>
                <div
                  className="absolute border-2 border-[#ff0050] bg-[#ff0050]/20"
                  style={{
                    left: `${wsRegion.x0 * 100}%`,
                    top: `${wsRegion.y0 * 100}%`,
                    width: `${(wsRegion.x1 - wsRegion.x0) * 100}%`,
                    height: `${(wsRegion.y1 - wsRegion.y0) * 100}%`,
                  }}
                />
                <div
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0050]"
                  style={{ left: `${wsRegion.cx * 100}%`, top: `${wsRegion.cy * 100}%` }}
                />
              </>
            )}
          </div>
        )}
        {wsMeta && (
          <p className="mt-2 text-center text-[11px] font-semibold text-stone-500">
            {wsMeta.band} · 비어있음 {(wsMeta.emptiness * 100).toFixed(0)}% · 크기 {(wsMeta.wRatio * 100).toFixed(0)}×{(wsMeta.hRatio * 100).toFixed(0)}% · {wsMeta.ms}ms
          </p>
        )}
      </div>

      <div className="mt-6">
        <PrimaryButton onClick={() => router.push(messageHref)}>다음</PrimaryButton>
      </div>
    </PhoneShell>
  );
}

export function PreviewScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const useAi = searchParams.get("ai") === "1"; // 배경 화면의 "AI로 만들기" → AI 합성
  const [draft, setDraft, draftHydrated] = useDraft();
  const [adjusting, setAdjusting] = useState(false);
  const [adjTab, setAdjTab] = useState<"title" | "content">("title");
  const { addCard } = useSupabaseCards();
  const uiSettings = usePublicUiSettings();
  const { hand_paper_enabled, hand_paper_style } = uiSettings;
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [debugPrompt, setDebugPrompt] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const savedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const card = useMemo<CardItem>(() => ({
    id: `card-${Date.now()}`,
    name: draft.title?.trim() || draft.message?.trim().slice(0, 12) || "무제",
    purpose: draft.purpose || "love",
    message: draft.message || "당신을 응원합니다. 오늘도 행복하세요.",
    bg: draft.bg || "flower",
    createdAt: new Date().toLocaleDateString("ko-KR").replace(/\.$/, ""),
  }), [draft]);

  const createCardImage = useCallback(async (useAI = false, mode?: "sub" | "pay", signal?: AbortSignal): Promise<{ url: string; blob: Blob }> => {
    const d = draftRef.current;
    // 하단 메세지 + 작성자 → 카드 하단 추가 문구
    const subText = [
      d.footer?.trim(),
      d.authorEnabled && d.author?.trim() ? `- ${d.author.trim()}` : "",
    ].filter(Boolean).join("\n") || undefined;
    const res = await fetch("/api/card-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.title || "",
          message: d.message || "당신을 응원합니다. 오늘도 행복하세요.",
          bg: d.bg || "flower",
          purpose: d.purpose || "love",
          hand_font: d.handFont,
          hand_tone: d.handTone,
          hand_mode: d.handMode,
          hand_paper_style,
          hand_paper_enabled,
          recipient_label: d.title || "", // 제목(받는분 대체)
          ai_compose: useAI,
          api_mode: mode,
          // 미리보기 수동 조정
          title_font: d.titleFont,
          content_font: d.contentFont,
          position: d.cardPosition,
          title_scale: d.titleScale,
          content_scale: d.contentScale,
          title_color: d.titleColor,
          content_color: d.contentColor,
          sub_text: subText,
      }),
      signal,
    });
    if (!res.ok) throw new Error("card image failed");
    const promptHeader = res.headers.get("X-AI-Prompt");
    if (promptHeader) setDebugPrompt(decodeURIComponent(promptHeader));
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), blob };
  }, [hand_paper_enabled, hand_paper_style]);

  // AI(OpenAI) 감성 합성은 백엔드 모듈(card-ai-compose)로 분리됨.
  // 프론트에서 다시 노출하려면 createCardImage(true, "sub")를 버튼에 연결.

  useEffect(() => {
    if (!draftHydrated) return;
    const abortController = new AbortController();
    const startedAt = Date.now();
    // 무료 로컬 렌더는 즉시(짧은 연출), AI 합성은 수십 초 → 긴 진행 연출
    const duration = useAi ? 90000 : 1400;
    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const linear = Math.min(elapsed / duration, 0.985);
      const wave = Math.sin(elapsed / 360) * 0.9 + Math.sin(elapsed / 970) * 0.45;
      const value = Math.min(99.38, Math.max(0, linear * 96 + wave));
      setProgress(value);
    }, 80);

    const minimumTimer = window.setTimeout(async () => {
      try {
        const [result] = await Promise.all([
          createCardImage(useAi, useAi ? "sub" : undefined, abortController.signal),
          new Promise((resolve) => window.setTimeout(resolve, Math.max(0, duration - (Date.now() - startedAt)))),
        ]);
        if (abortController.signal.aborted) return;
        const { url: imageUrl, blob: imageBlob } = result as { url: string; blob: Blob };
        setCardImageUrl(imageUrl);
        setProgress(100);
        setDone(true);
        if (!savedRef.current) {
          savedRef.current = true;
          const id = await addCard(draftRef.current, imageBlob);
          setSavedCardId(id);
        }
      } catch {
        if (abortController.signal.aborted) return;
        setGenerationError(useAi ? "AI 감성 합성에 실패했습니다. 다시 시도해주세요." : "카드 생성에 실패했습니다. 다시 시도해주세요.");
        setProgress(100);
        setDone(true);
        if (!savedRef.current) {
          savedRef.current = true;
          addCard(draftRef.current, null).then(setSavedCardId).catch(console.error);
        }
      } finally {
        window.clearInterval(progressTimer);
      }
    }, 0);

    return () => {
      abortController.abort();
      window.clearInterval(progressTimer);
      window.clearTimeout(minimumTimer);
    };
  }, [addCard, createCardImage, draftHydrated, useAi]);

  // 미리보기 조정(글씨체/배치/크기) 변경 시 로컬 렌더 재생성
  const adjustKey = [
    draft.titleFont ?? "", draft.contentFont ?? "", draft.cardPosition ?? "", draft.titleScale ?? 1, draft.contentScale ?? 1,
    draft.titleColor ?? "", draft.contentColor ?? "", draft.title ?? "", draft.message ?? "",
  ].join("|");
  useEffect(() => {
    if (!done || useAi) return;
    let cancelled = false;
    setAdjusting(true);
    // 디바운스 (추가문구 타이핑 등 연속 변경 대응)
    const timer = window.setTimeout(async () => {
      try {
        const { url } = await createCardImage(false, undefined);
        if (!cancelled) setCardImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch {
        /* 조정 재생성 실패 무시 */
      } finally {
        if (!cancelled) setAdjusting(false);
      }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustKey]);

  // 생성 시작부터 뒤로가기 차단 — 홈으로 보냄 (진행 중 이탈 시 API 낭비 방지)
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPop = () => router.replace("/home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router]);

  const downloadCard = useCallback(async () => {
    if (!cardImageUrl || downloading) return;
    setDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = cardImageUrl;
      a.download = `마음카드_${card.name}_${Date.now()}.png`;
      a.click();
    } catch {
      window.alert("이미지 저장에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }, [card.name, cardImageUrl, downloading]);

  if (!done) {
    const sparkles = ["✨", "💫", "🌸", "💌", "🌟", "✿"];
    const loadingStage =
      progress < 20 ? "배경과 문구 조화를 찾는 중..."
      : progress < 45 ? "감성 레이아웃 계산 중..."
      : progress < 70 ? "캘리그래피 최적 위치 배치 중..."
      : progress < 90 ? "마지막 감성 터치 추가 중..."
      : "거의 완성됐어요!";

    return (
      <PhoneShell backHref="/home">
        <div className="flex min-h-[640px] flex-col items-center justify-center text-center">
          {/* 반짝이는 파티클 (hydration 이후 클라이언트 전용 렌더 — SSR 불일치 방지) */}
          <div className="relative mb-2 h-40 w-40" suppressHydrationWarning>
            {draftHydrated && sparkles.map((s, i) => (
              <span
                key={i}
                className="absolute text-2xl"
                style={{
                  top: `${(20 + Math.sin((i * Math.PI * 2) / sparkles.length) * 40).toFixed(3)}%`,
                  left: `${(20 + Math.cos((i * Math.PI * 2) / sparkles.length) * 40).toFixed(3)}%`,
                  animation: `ping ${(1.2 + i * 0.3).toFixed(1)}s ease-in-out ${(i * 0.2).toFixed(1)}s infinite`,
                  opacity: 0.7,
                }}
              >
                {s}
              </span>
            ))}
            <div className="absolute inset-4 rounded-full border-[8px] border-orange-100/50" />
            <div className="absolute inset-4 animate-spin rounded-full border-[8px] border-transparent border-t-[#7b310d] border-r-[#d98238]" style={{ animationDuration: "1.5s" }} />
            <div className="absolute inset-8 animate-spin rounded-full border-4 border-transparent border-b-orange-300 border-l-[#f0b35c]" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
            <div className="absolute inset-0 flex items-center justify-center text-4xl rounded-full">💌</div>
          </div>
          <h1 className="mt-4 text-xl font-black leading-8 text-[#5a240d]">마음을 담아<br />카드를 만들고 있어요.</h1>
          <p className="mt-2 text-sm font-semibold text-stone-500 transition-opacity duration-300">{loadingStage}</p>
          <div className="mt-6 w-full max-w-xs">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-stone-500">
              <span>✨ 감성 카드 생성</span>
              <span>{Math.floor(progress)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7b310d] via-[#d98238] to-[#f0b35c] transition-all duration-200"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-stone-400">
              <span>시작</span>
              <span>예상 시간: 약 1분 30초</span>
            </div>
          </div>
          <div className="mt-5 flex gap-3 text-xs font-semibold text-stone-400">
            {["배경 분석", "문구 배치", "감성 합성"].map((step, i) => (
              <span
                key={step}
                className={`flex items-center gap-1 rounded-full px-3 py-1 ${
                  progress > i * 33 ? "bg-orange-100 text-[#7b310d]" : "bg-stone-100"
                }`}
              >
                {progress > i * 33 + 33 ? "✓" : "·"} {step}
              </span>
            ))}
          </div>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell backHref="/home">
      {cardImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cardImageUrl} alt="완성된 마음카드" className="w-full rounded-2xl shadow-lg" />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="font-bold text-red-700">{generationError ?? "AI 감성 합성 이미지가 아직 생성되지 않았습니다."}</p>
        </div>
      )}
      {/* 미리보기 조정 (로컬 렌더 전용) */}
      {!useAi && cardImageUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
          {/* 폰트 미리보기용 @font-face (각 글씨체를 실제 모양으로 표시) */}
          <style>{CARD_FONTS.map((f) => `@font-face{font-family:'${f.family}';src:url('/fonts/${f.file}') format('truetype');font-display:swap;}`).join("")}</style>

          {/* 책갈피 탭 (최상단) — 제목/내용 각각 독립 편집 */}
          <div className="flex items-end gap-1.5 bg-stone-100 px-3 pt-2.5">
            {([["title", "제목", "Aa"], ["content", "내용", "¶"]] as const).map(([id, label, icon]) => {
              const active = adjTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setAdjTab(id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-xl px-4 text-sm font-black transition ${active ? "bg-white py-3 text-[#7b310d] shadow-[0_-2px_6px_rgba(120,49,13,0.07)]" : "bg-stone-200/60 py-2.5 text-stone-400 hover:bg-stone-200"}`}
                >
                  <span className="text-base">{icon}</span>
                  {label}
                </button>
              );
            })}
          </div>

          {(() => {
            const isTitle = adjTab === "title";
            const fontKey = isTitle ? "titleFont" : "contentFont";
            const colorKey = isTitle ? "titleColor" : "contentColor";
            const scaleKey = isTitle ? "titleScale" : "contentScale";
            const fontVal = (isTitle ? draft.titleFont : draft.contentFont) ?? "pen";
            const colorVal = (isTitle ? draft.titleColor : draft.contentColor) ?? "auto";
            const scaleVal = (draft[scaleKey] as number | undefined) ?? 1;
            const sampleText = isTitle ? (draft.title?.trim() || "제목 미리보기") : (draft.message?.trim()?.slice(0, 8) || "내용 미리보기");
            return (
              <div className="space-y-4 p-4">
                {/* 문구 수정 */}
                <div>
                  <label className="text-xs font-bold text-stone-500">{isTitle ? "제목 문구" : "내용 문구"}</label>
                  {isTitle ? (
                    <input
                      type="text"
                      value={draft.title ?? ""}
                      onChange={(e) => setDraft({ title: e.target.value })}
                      placeholder="제목 (비우면 내용만 표시)"
                      maxLength={20}
                      className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 px-3.5 text-sm outline-none focus:border-[#7b310d]"
                    />
                  ) : (
                    <textarea
                      value={draft.message ?? ""}
                      onChange={(e) => setDraft({ message: e.target.value })}
                      placeholder="내용을 입력하세요"
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm leading-6 outline-none focus:border-[#7b310d]"
                    />
                  )}
                </div>

                {/* 글씨체 — 각 폰트를 실제 글씨체로 보여주는 세로 리스트 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">글씨체 <span className="font-normal text-stone-400">({CARD_FONTS.length}종)</span></label>
                    {adjusting && <span className="text-[11px] font-semibold text-[#7b310d]">적용 중...</span>}
                  </div>
                  <div className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-stone-200">
                    {(["손글씨", "명조", "고딕", "디자인"] as const).map((group) => (
                      <div key={group}>
                        <div className="sticky top-0 z-10 bg-stone-50 px-3 py-1 text-[10px] font-bold tracking-wide text-stone-400">{group}</div>
                        {CARD_FONTS.filter((f) => f.group === group).map((f) => {
                          const active = fontVal === f.id;
                          return (
                            <button
                              key={f.id}
                              onClick={() => setDraft({ [fontKey]: f.id })}
                              className={`flex w-full items-center justify-between gap-3 border-b border-stone-50 px-3 py-2 text-left transition ${active ? "bg-orange-50" : "hover:bg-stone-50"}`}
                            >
                              <span className="min-w-0 flex-1 truncate text-2xl leading-tight text-stone-800" style={{ fontFamily: f.family }}>
                                {sampleText}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className={`text-[11px] font-semibold ${active ? "text-[#7b310d]" : "text-stone-400"}`}>{f.label}</span>
                                {active && <Check size={15} className="text-[#7b310d]" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 색 */}
                <div>
                  <label className="text-xs font-bold text-stone-500">글자색</label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDraft({ [colorKey]: "auto" })}
                      className={`h-9 rounded-lg border px-3 text-xs font-bold transition ${colorVal === "auto" ? "border-[#7b310d] bg-[#7b310d] text-white" : "border-stone-200 bg-white text-stone-600"}`}
                    >
                      자동
                    </button>
                    {(["#3b1f10", "#000000", "#fdf6ec", "#7b310d", "#d6336c", "#c2410c", "#1e3a5f", "#2f6b4f", "#6f3cc3"]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setDraft({ [colorKey]: c })}
                        aria-label={c}
                        className={`h-9 w-9 rounded-full border-2 transition ${colorVal === c ? "border-[#7b310d] ring-2 ring-[#7b310d]/40" : "border-white shadow"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* 크기 슬라이더 */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500">글씨 크기</label>
                    <span className="text-xs font-bold text-[#7b310d]">{Math.round(scaleVal * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={180}
                    step={5}
                    value={Math.round(scaleVal * 100)}
                    onChange={(e) => setDraft({ [scaleKey]: Number(e.target.value) / 100 })}
                    className="mt-2 h-2 w-full accent-[#7b310d]"
                  />
                </div>

                {/* 배치 (공통) */}
                <div>
                  <label className="text-xs font-bold text-stone-500">글씨 배치 <span className="font-normal text-stone-400">(공통)</span></label>
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                    {([["auto", "자동"], ["top", "위"], ["center", "가운데"], ["bottom", "아래"]] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setDraft({ cardPosition: id })}
                        className={`h-9 rounded-lg border text-xs font-bold transition ${(draft.cardPosition ?? "auto") === id ? "border-[#7b310d] bg-orange-50 text-[#7b310d]" : "border-stone-200 bg-white text-stone-500"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <button
          onClick={() => setShareOpen(true)}
          className="flex h-12 w-full items-center justify-center rounded-md bg-[#fee500] font-black text-stone-950"
        >
          공유하기
        </button>
        <button
          onClick={downloadCard}
          disabled={downloading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-stone-200 font-bold disabled:opacity-50"
        >
          <Download size={18} /> {downloading ? "저장 중..." : "이미지 저장"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <SecondaryLink href="/create/background"><RotateCcw size={18} /> 다시 만들기</SecondaryLink>
          <SecondaryLink href="/library"><Folder size={18} /> 보관함 저장</SecondaryLink>
        </div>
      </div>
      {shareOpen && <ShareSheet onClose={() => setShareOpen(false)} card={card} cardId={savedCardId} draft={draft} />}

      {/* 디버그 패널 */}
      {debugPrompt && (
        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="flex w-full items-center justify-between font-bold text-violet-700"
          >
            <span>🔍 AI 프롬프트 보기</span>
            <span>{showDebug ? "▲" : "▼"}</span>
          </button>
          {showDebug && (
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-violet-900">
              {debugPrompt}
            </pre>
          )}
        </div>
      )}
    </PhoneShell>
  );
}

function ShareSheet({
  onClose,
  card,
  cardId,
  draft,
}: {
  onClose: () => void;
  card: Pick<CardItem, "name" | "message">;
  cardId: string | null;
  draft: Draft;
}) {
  const [instaToast, setInstaToast] = useState(false);

  const handleKakao = () => {
    onClose();
    shareCard({
      recipientName: card.name,
      honorific: draft.honorific || "에게",
      message: card.message,
      cardId: cardId ?? undefined,
    });
  };

  const shareUrl = cardId
    ? `${window.location.origin}/share/${cardId}`
    : window.location.origin;

  const handleInstagram = async () => {
    const imgUrl = cardId ? `/api/card-image?cardId=${cardId}` : null;
    if (imgUrl) {
      const a = document.createElement("a");
      a.href = imgUrl;
      a.download = `maum-card-${cardId}.png`;
      a.click();
    }
    setInstaToast(true);
    setTimeout(() => setInstaToast(false), 3500);
  };

  const handleNaver = () => {
    const title = encodeURIComponent(`${card.name}에게 보내는 마음 카드`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://share.naver.com/web/shareView?url=${url}&title=${title}`, "_blank");
  };

  const otherApps = [
    ["N", "네이버", "bg-green-500 text-white", handleNaver],
    ["f", "Facebook", "bg-blue-600 text-white", () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)],
    ["◎", "Instagram", "bg-pink-500 text-white", handleInstagram],
    ["💬", "메시지", "bg-green-400", () => window.open(`sms:?body=${encodeURIComponent(shareUrl)}`)],
    ["•••", "더보기", "bg-stone-100", () => navigator.share?.({ url: shareUrl }).catch(() => {})],
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-4 pb-5">
      {instaToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 rounded-xl bg-gray-900/90 px-5 py-3 text-center text-sm font-bold text-white shadow-lg">
          이미지 저장 완료! 📸<br />
          <span className="text-xs font-normal text-gray-300">Instagram 앱에서 스토리나 피드에 공유해보세요</span>
        </div>
      )}
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-center">
        <h2 className="text-lg font-black">공유할 앱을 선택해주세요.</h2>
        <div className="mt-7 grid grid-cols-3 gap-6">
          <button onClick={handleKakao} className="grid place-items-center gap-2 text-sm font-bold">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-yellow-300 text-lg font-black">TALK</span>
            카카오톡
          </button>
          {otherApps.map(([mark, label, cls, handler]) => (
            <button key={label} onClick={handler} className="grid place-items-center gap-2 text-sm font-bold">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-black ${cls}`}>{mark}</span>
              {label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-7 h-12 w-full rounded-md bg-stone-100 font-bold">취소</button>
      </div>
    </div>
  );
}

export function LibraryScreen() {
  const { cards, loading, toggleFav, hideCard, deleteCard, deleteAll } = useSupabaseCards();
  const uiSettings = usePublicUiSettings();
  const [, setDraft] = useDraft();
  const router = useRouter();
  const [tab, setTab] = useState("전체");
  const [editMode, setEditMode] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<CardItem | null>(null);
  const [msgExpanded, setMsgExpanded] = useState(false);

  const displayed = cards.filter((card) => !hiddenIds.includes(card.id) && (tab !== "즐겨찾기" || card.favorite));

  const handleDelete = (cardId: string) => {
    deleteCard(cardId);
    setConfirmId(null);
  };

  const handleDeleteAll = async () => {
    await deleteAll();
    setConfirmAll(false);
    setEditMode(false);
  };

  const handleEdit = (card: CardItem) => {
    setDraft({
      purpose: card.purpose,
      name: card.name,
      message: card.message,
      bg: card.bg,
    });
    router.push("/create/message");
  };

  const handleHide = (cardId: string) => {
    hideCard(cardId);
    setHiddenIds((prev) => prev.includes(cardId) ? prev : [...prev, cardId]);
    setConfirmId(null);
  };

  return (
    <PhoneShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">내가 만든 카드</h1>
        <button
          onClick={() => { setEditMode((v) => !v); setConfirmId(null); setConfirmAll(false); }}
          className={`text-sm font-bold ${editMode ? "text-[#7b310d]" : "text-stone-500"}`}
        >
          {editMode ? "완료" : "편집"}
        </button>
      </div>
      {editMode && cards.length > 0 && (
        confirmAll ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="flex-1 text-xs font-bold text-red-700">카드 {cards.length}개를 모두 삭제할까요?</span>
            <button onClick={handleDeleteAll} className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white">삭제</button>
            <button onClick={() => setConfirmAll(false)} className="rounded-md bg-stone-200 px-3 py-1 text-xs font-bold text-stone-600">취소</button>
          </div>
        ) : (
          <button onClick={() => setConfirmAll(true)} className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-500">
            전체 삭제
          </button>
        )
      )}
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-md bg-stone-100 p-1">
        {["전체", "즐겨찾기", "공유한 카드"].map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`h-9 rounded-md text-sm font-bold ${tab === item ? "bg-[#7b310d] text-white" : "text-stone-600"}`}>{item}</button>
        ))}
      </div>
      {!loading && displayed.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-stone-200 py-12 text-center">
          <p className="font-bold text-stone-500">카드가 없어요.</p>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        {displayed.map((card) => (
          <article key={card.id} className="relative rounded-lg border border-stone-200 bg-white p-2">
            {editMode && (
              <div className="absolute right-2 top-2 z-10 flex gap-1">
                <button
                  onClick={() => handleHide(card.id)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-stone-600 shadow"
                  aria-label="숨김"
                >
                  <EyeOff size={13} />
                </button>
                <button
                  onClick={() => handleEdit(card)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#7b310d] shadow"
                  aria-label="수정"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setConfirmId(confirmId === card.id ? null : card.id)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-red-500 text-white shadow"
                  aria-label="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
            {confirmId === card.id && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/60 p-3">
                <p className="text-center text-xs font-bold text-white">삭제할까요?</p>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="h-8 w-full rounded-md bg-red-500 text-xs font-bold text-white"
                >
                  삭제
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="h-8 w-full rounded-md bg-white/20 text-xs font-bold text-white"
                >
                  취소
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { if (!editMode) { setExpandedCard(card); setMsgExpanded(false); } }}
              className="block w-full text-left"
              aria-label={`${card.name} 카드 확대`}
            >
              <CardArt card={card} />
            </button>
            <div className="mt-2 flex items-center justify-between px-1">
              <div>
                <div className="font-bold">{card.name}</div>
                <div className="text-xs text-stone-500">{card.createdAt}</div>
              </div>
              {!editMode && (
                <button onClick={() => toggleFav(card.id, !card.favorite)} aria-label="즐겨찾기">
                  <Star size={19} className={card.favorite ? "fill-amber-400 text-amber-400" : "text-stone-400"} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {loading && (
        <div className="mt-10 grid place-items-center py-12 text-sm font-semibold text-stone-400">
          불러오는 중...
        </div>
      )}
      {expandedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setExpandedCard(null)}>
          <div className="relative w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setExpandedCard(null)}
              className="absolute -right-2 -top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-stone-800 shadow"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
            <CardArt card={expandedCard} />
            <div className="mt-3 rounded-xl bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-black">{expandedCard.name}</div>
                <button
                  onClick={() => setMsgExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs font-bold text-[#7b310d]"
                >
                  {msgExpanded ? "접기" : "내용보기"}
                  <ChevronDown size={14} className={`transition-transform duration-200 ${msgExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
              {msgExpanded && (
                <p
                  className="mt-2 whitespace-pre-wrap text-stone-600"
                  style={
                    expandedCard.purpose === "hand"
                      ? { fontSize: `${uiSettings.hand_viewer_font_size}px`, lineHeight: 1.85 }
                      : { fontSize: "14px", lineHeight: 1.75 }
                  }
                >
                  {expandedCard.message}
                </p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => {
                  const imgUrl = expandedCard.bg;
                  if (!imgUrl) return;
                  if (navigator.share) {
                    try { await navigator.share({ title: expandedCard.name, url: imgUrl }); } catch { /* cancelled */ }
                  } else {
                    try {
                      const res = await fetch(imgUrl);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `마음카드_${expandedCard.name}_${Date.now()}.jpg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      window.open(imgUrl, "_blank");
                    }
                  }
                }}
                className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-bold text-stone-700 shadow"
              >
                <Share2 size={15} /> 공유하기
              </button>
              <button
                onClick={async () => {
                  const imgUrl = expandedCard.bg;
                  if (!imgUrl) return;
                  try {
                    const res = await fetch(imgUrl);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `마음카드_${expandedCard.name}_${Date.now()}.jpg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(imgUrl, "_blank");
                  }
                }}
                className="flex flex-1 h-11 items-center justify-center gap-1.5 rounded-xl bg-white font-bold text-stone-700 shadow"
              >
                <Download size={15} /> 저장하기
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`"${expandedCard.name}" 카드를 삭제할까요?`)) {
                    handleDelete(expandedCard.id);
                    setExpandedCard(null);
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500 text-white shadow"
                aria-label="삭제"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCreditReason(reason: string) {
  if (reason === "signup_bonus") return "가입 축하 크레딧";
  if (reason === "ai_generate") return "AI 배경 생성";
  if (reason.startsWith("purchase:")) {
    const planId = reason.split(":")[1];
    if (planId === "basic") return "기본 플랜 충전";
    if (planId === "standard") return "스탠다드 플랜 충전";
    return "크레딧 충전";
  }
  return "크레딧 변동";
}

function FavoriteMessagesScreen({ onBack, onUse }: { onBack: () => void; onUse: (text: string) => void }) {
  const { favorites, loading, remove } = useFavMessages();
  const purposeLabel: Record<string, string> = {
    birthday: "생일", love: "안부", health: "건강", thanks: "감사",
    comfort: "위로", congrats: "명절", morning: "아침 인사", night: "저녁 인사", hand: "손편지", custom: "기타",
  };

  return (
    <PhoneShell>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft /></button>
        <h1 className="font-black">즐겨찾기 문구</h1>
      </div>
      {loading ? (
        <div className="grid py-16 place-items-center text-sm font-semibold text-stone-500">불러오는 중...</div>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 px-4 py-14 text-center">
          <div className="text-5xl">🔖</div>
          <p className="mt-3 font-bold text-stone-700">저장된 문구가 없어요.</p>
          <p className="mt-1 text-sm font-semibold text-stone-500">
            카드 만들기에서 마음에 드는 문구 옆<br />북마크 버튼을 눌러 저장해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <article key={fav.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm leading-6 text-stone-800">{fav.text}</p>
              <div className="mt-3 flex items-center justify-between">
                {fav.purpose ? (
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-[#7b310d]">
                    {purposeLabel[fav.purpose] ?? fav.purpose}
                  </span>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    onClick={() => onUse(fav.text)}
                    className="rounded-md bg-[#7b310d] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    카드에 사용
                  </button>
                  <button
                    onClick={() => remove(fav.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PhoneShell>
  );
}

export function MyPageScreen() {
  const { user, loading, refresh } = useAuth();
  const { transactions, loading: transactionsLoading, refresh: refreshTransactions } = useCreditTransactions();
  const router = useRouter();
  const [view, setView] = useState<"menu" | "profile" | "purchases" | "notifications" | "favorites">("menu");
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const openProfile = () => {
    setNicknameInput(user?.nickname ?? "");
    setNicknameSaved(false);
    setView("profile");
  };

  const saveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || !user) return;
    setSavingNickname(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: trimmed })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      setNicknameSaved(true);
      setTimeout(() => setView("menu"), 1200);
    } catch {
      // silently fail — user stays on form
    } finally {
      setSavingNickname(false);
    }
  };

  const purchaseTransactions = transactions.filter((tx) => tx.amount > 0);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/login");
  }, [router]);

  if (loading) {
    return (
      <PhoneShell>
        <div className="space-y-4 py-8">
          <div className="h-20 rounded-2xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
          <div className="h-12 rounded-xl bg-stone-100 animate-pulse" />
        </div>
      </PhoneShell>
    );
  }

  if (!user) {
    return (
      <PhoneShell>
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="text-6xl">💞</div>
          <p className="font-bold text-stone-600">로그인이 필요합니다</p>
          <Link href="/login" className="h-12 w-full max-w-xs flex items-center justify-center rounded-md bg-white border border-stone-200 font-black text-stone-900 shadow-sm">
            Google로 시작하기
          </Link>
        </div>
      </PhoneShell>
    );
  }

  if (view === "profile") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">내 정보 관리</h1>
          <div className="w-10" />
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar url={user.avatarUrl} nickname={user.nickname} size={80} />
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-bold">닉네임</label>
            <input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={20}
              placeholder="닉네임을 입력해주세요"
              className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
            />
            <p className="mt-1 text-right text-xs text-stone-400">{nicknameInput.length}/20</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold">이메일</label>
            <div className="h-12 w-full rounded-md border border-stone-100 bg-stone-50 px-4 flex items-center text-stone-500 text-sm">
              Google 계정으로 연결됨
            </div>
          </div>

          <button
            onClick={saveNickname}
            disabled={savingNickname || !nicknameInput.trim() || nicknameInput.trim() === user.nickname}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-bold text-white disabled:bg-stone-300"
          >
            {nicknameSaved ? (
              <><Check size={18} /> 저장됐어요!</>
            ) : savingNickname ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>
      </PhoneShell>
    );
  }

  if (view === "favorites") {
    return (
      <FavoriteMessagesScreen
        onBack={() => setView("menu")}
        onUse={(text) => {
          writeJson("maumcard:draft", { ...readJson("maumcard:draft", defaultDraft), message: text });
          router.push("/create/message");
        }}
      />
    );
  }

  if (view === "notifications") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">알림 설정</h1>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <div className="text-4xl">🔔</div>
          <h2 className="mt-3 text-base font-black text-amber-900">이메일 알림 서비스 준비 중</h2>
          <p className="mt-2 text-sm font-semibold text-amber-800 leading-relaxed">
            기념일 D-7, D-1 이메일 알림 기능을 <br />
            <span className="font-black">2026년 7월</span>에 출시할 예정입니다.
          </p>
          <p className="mt-3 text-xs text-amber-700">
            출시되면 등록된 이메일로 자동 알림이 전송됩니다.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white divide-y">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">기념일 D-7 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">기념일 7일 전 이메일 발송</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">기념일 D-1 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">기념일 전날 이메일 발송</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-bold text-sm">카드 수신 알림</p>
              <p className="text-xs text-stone-500 mt-0.5">누군가 내게 카드를 보냈을 때</p>
            </div>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-400">예정</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          Google 계정 이메일로 알림이 발송됩니다.
        </p>
      </PhoneShell>
    );
  }

  if (view === "purchases") {
    return (
      <PhoneShell>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setView("menu")}><ChevronLeft /></button>
          <h1 className="font-black">구매 내역</h1>
          <button onClick={refreshTransactions} className="text-sm font-bold text-[#7b310d]">새로고침</button>
        </div>

        {transactionsLoading ? (
          <div className="grid py-16 place-items-center text-sm font-semibold text-stone-500">
            구매 내역을 불러오고 있어요.
          </div>
        ) : purchaseTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 px-4 py-12 text-center">
            <div className="text-5xl">💳</div>
            <p className="mt-3 font-bold text-stone-700">아직 구매 내역이 없어요.</p>
            <p className="mt-1 text-sm font-semibold text-stone-500">크레딧을 충전하면 이곳에 기록됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {purchaseTransactions.map((tx) => (
              <article key={tx.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[#5a240d]">{formatCreditReason(tx.reason)}</h2>
                    <p className="mt-1 text-xs font-semibold text-stone-500">{formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-[#7b310d]">
                    +{tx.amount}개
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
      <section className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setThemeOpen(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-outline-variant/30 bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container"
          aria-label="디자인 설정"
        >
          <Settings size={19} />
        </button>
        <Avatar url={user.avatarUrl} nickname={user.nickname} size={72} />
        <div>
          <h1 className="text-xl font-black">{user.nickname}님</h1>
          <p className="mt-1 text-sm font-semibold text-stone-600">오늘도 좋은 하루 되세요!</p>
          <div className="mt-2">
            <CreditBalance credits={user.credits} customerName={user.nickname} onCharged={refresh} />
          </div>
        </div>
      </section>
      <div className="mt-7 divide-y rounded-lg border border-stone-200">
        {isAdminEmail(user.email) && (
          <button
            onClick={() => router.push("/admin")}
            className="flex w-full items-center justify-between px-4 py-4 font-semibold text-[#7b310d]"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} />
              관리자 페이지
            </span>
            <ChevronRight size={18} />
          </button>
        )}
        <button onClick={openProfile} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          내 정보 관리<ChevronRight size={18} />
        </button>
        <button onClick={() => router.push("/library")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          내가 만든 카드<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("favorites")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          즐겨찾기 문구<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("purchases")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          구매 내역<ChevronRight size={18} />
        </button>
        <button onClick={() => setView("notifications")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          알림 설정<ChevronRight size={18} />
        </button>
        <button onClick={() => window.alert("고객센터 화면입니다.")} className="flex w-full items-center justify-between px-4 py-4 font-semibold">
          고객센터<ChevronRight size={18} />
        </button>
        <button onClick={handleSignOut} className="flex w-full items-center justify-between px-4 py-4 font-semibold text-red-500">
          로그아웃<ChevronRight size={18} />
        </button>
      </div>
    </PhoneShell>
  );
}

const ANNIV_TYPE_ICONS: Record<string, string> = {
  birthday: "🎂",
  love: "❤️",
  anniversary: "💍",
  thanks: "🌸",
  friendship: "👫",
  family: "👨‍👩‍👧",
  other: "✨",
};

const ANNIV_TYPE_LABELS: Record<string, string> = {
  birthday: "생일",
  love: "연인",
  anniversary: "기념일",
  thanks: "감사",
  friendship: "우정",
  family: "가족",
  other: "기타",
};

function getDDay(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = new Date(today.getFullYear(), parts[1] - 1, parts[2]);
  if (target.getTime() < today.getTime()) {
    target = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2]);
  }
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "오늘";
  return `D-${diff}`;
}

function formatAnnivDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return "";
  return `${parts[1]}월 ${parts[2]}일`;
}

const ANNIV_TO_PURPOSE: Record<string, Purpose> = {
  birthday: "birthday",
  love: "love",
  anniversary: "love",
  thanks: "thanks",
  friendship: "love",
  family: "health",
  other: "custom",
};

export function AnniversaryScreen() {
  const { items, add, update, remove } = useSupabaseAnniversaries();
  const { items: commonItems } = useCommonAnniversaries();
  const router = useRouter();
  const [, setDraft] = useDraft();
  const [mode, setMode] = useState<"home" | "calendar" | "manage" | "add">("home");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [listPage, setListPage] = useState(0);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("birthday");
  const [newMemo, setNewMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth - 1, 1).getDay();
  const calDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // unified display items: personal + common anniversaries
  const allDisplayItems = useMemo(() => {
    const personal = items.map((a) => ({
      id: `user-${a.id}`,
      name: a.name,
      date: a.date,
      anniversary_type: a.anniversary_type,
      memo: a.memo ?? null,
      source: "user" as const,
    }));
    const common = commonItems
      .map((item) => {
        const date = getDefaultAnniversaryDate(item);
        if (!date) return null;
        return {
          id: `common-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo ?? null,
          source: "common" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return [...personal, ...common];
  }, [items, commonItems]);

  const calendarDisplayItems = useMemo(() => {
    const personal = items.map((a) => ({
      id: `user-${a.id}`,
      name: a.name,
      date: a.date,
      anniversary_type: a.anniversary_type,
      memo: a.memo ?? null,
      source: "user" as const,
    }));
    const common = commonItems
      .map((item) => {
        const date = getCalendarAnniversaryDate(item, calYear);
        if (!date) return null;
        return {
          id: `common-${item.id}`,
          name: item.name,
          date,
          anniversary_type: item.anniversary_type,
          memo: item.memo ?? null,
          source: "common" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    return [...personal, ...common];
  }, [items, commonItems, calYear]);

  const annivDaysSet = new Set(
    calendarDisplayItems.flatMap((a) => {
      const parts = a.date.split("-").map(Number);
      return parts[1] === calMonth ? [parts[2]] : [];
    }),
  );

  const selectedDayItems = calendarDisplayItems.filter((a) => {
    const parts = a.date.split("-").map(Number);
    return parts[1] === calMonth && parts[2] === selectedDay;
  });

  const categoryOptions = [
    { id: "all", label: "전체" },
    ...Object.entries(ANNIV_TYPE_LABELS).map(([id, label]) => ({ id, label })),
  ];

  const filteredList = [...allDisplayItems]
    .filter((item) => categoryFilter === "all" || item.anniversary_type === categoryFilter)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const safePage = Math.min(listPage, totalPages - 1);
  const pagedItems = filteredList.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const resetForm = () => {
    setNewName("");
    setNewDate("");
    setNewType("birthday");
    setNewMemo("");
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setMode("add");
  };

  const startEdit = (item: AnnivItem) => {
    setEditingId(item.id);
    setNewName(item.name);
    setNewDate(item.date);
    setNewType(item.anniversary_type);
    setNewMemo(item.memo ?? "");
    setMode("add");
  };

  const handleSave = async () => {
    if (!newName.trim() || !newDate) return;
    setSaving(true);
    try {
      const data = { name: newName.trim(), date: newDate, anniversary_type: newType, memo: newMemo || undefined };
      if (editingId) {
        await update(editingId, data);
      } else {
        await add(data);
      }
      resetForm();
      setMode("manage");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <PhoneShell title="기념일">
      {mode === "home" && (
        <>
          <div className="rounded-lg bg-orange-50 p-5">
            <p className="font-bold leading-7">오늘도 소중한 사람에게 마음을 전해보세요. ❤️</p>
          </div>
          <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-sm text-stone-700">기념일 목록</h2>
              <span className="text-xs font-semibold text-stone-400">
                {filteredList.length}개
              </span>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categoryOptions.map((option) => {
                const active = categoryFilter === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setCategoryFilter(option.id);
                      setListPage(0);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#7b310d] text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              {pagedItems.length > 0 ? (
                pagedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
                    <span className="text-2xl">{ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-sm text-stone-900">{item.name}</div>
                      <div className="text-xs text-stone-500">
                        {formatAnnivDate(item.date)} · {ANNIV_TYPE_LABELS[item.anniversary_type] ?? "기타"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const purpose = ANNIV_TO_PURPOSE[item.anniversary_type] ?? "love";
                          setDraft({
                            purpose,
                            name: item.name,
                            recipientPreset: "",
                            honorific: item.anniversary_type === "love" ? "님" : "에게",
                            message: "",
                            bg: "flower",
                            handTone: item.anniversary_type === "love" ? "love" : "general",
                            handMode: "recommend",
                          });
                          router.push("/create/message");
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full bg-[#7b310d] px-4 text-sm font-bold whitespace-nowrap text-white shadow-sm transition active:scale-[0.98]"
                      >
                        카드 만들기
                      </button>
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-[#7b310d]">
                        {getDDay(item.date)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-stone-200 px-4 py-8 text-center text-sm font-semibold text-stone-500">
                  선택한 카테고리에 기념일이 없어요.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded-md border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-xs font-semibold text-stone-500">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="rounded-md border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <AnnivAction icon={<CalendarDays />} title="달력으로 보기" text="기념일을 달력에서 확인하세요." onClick={() => setMode("calendar")} />
            <AnnivAction icon={<Pencil />} title="기념일 관리" text="기념일을 추가하거나 삭제하세요." onClick={() => setMode("manage")} />
          </div>
        </>
      )}

      {mode === "calendar" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode("home")}><ChevronLeft /></button>
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100"><ChevronLeft size={16} /></button>
              <h1 className="font-black">{calYear}년 {calMonth}월</h1>
              <button onClick={nextMonth} className="grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100"><ChevronRight size={16} /></button>
            </div>
            <button onClick={startAdd} className="grid h-9 w-9 place-items-center rounded-full bg-[#7b310d] text-white"><Plus size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
              <div key={d} className="py-1 font-bold text-stone-500 text-xs">{d}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {calDays.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative aspect-square rounded-full text-sm font-semibold ${
                  selectedDay === day ? "bg-[#7b310d] text-white" :
                  annivDaysSet.has(day) ? "bg-orange-100 text-[#7b310d]" : ""
                }`}
              >
                {day}
                {annivDaysSet.has(day) && selectedDay !== day && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#7b310d]" />
                )}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-stone-200 p-4">
            {selectedDayItems.length > 0 ? (
              <div className="space-y-3">
                {selectedDayItems.map((item) => (
                  <div key={item.id}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}</span>
                      <div>
                        <h2 className="font-black">{item.name}</h2>
                        <p className="text-sm text-stone-600">{ANNIV_TYPE_LABELS[item.anniversary_type] ?? "기타"}</p>
                      </div>
                    </div>
                    {item.memo && <p className="mt-2 text-sm leading-6 text-stone-600">{item.memo}</p>}
                    <button
                      onClick={() => {
                        const purpose = ANNIV_TO_PURPOSE[item.anniversary_type] ?? "love";
                        setDraft({ purpose, message: "", bg: "flower" });
                        router.push("/create/message");
                      }}
                      className="mt-3 grid h-11 w-full place-items-center rounded-md bg-[#7b310d] font-bold text-white text-sm"
                    >
                      카드 만들기
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="py-4 text-center font-semibold text-stone-500">이 날짜의 기념일이 없어요.</p>
                <button onClick={startAdd} className="h-11 w-full rounded-md border border-[#7b310d]-strong font-bold text-[#7b310d] text-sm">기념일 추가하기</button>
              </>
            )}
          </div>
        </>
      )}

      {mode === "manage" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode("home")}><ChevronLeft /></button>
            <h1 className="font-black">기념일 관리</h1>
            <div className="w-10" />
          </div>
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-5xl mb-3">🗓️</div>
              <p className="font-semibold text-stone-500">등록된 기념일이 없어요.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border border-stone-200">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-50 text-xl shrink-0">
                    {ANNIV_TYPE_ICONS[item.anniversary_type] ?? "✨"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{item.name}</div>
                    <div className="text-sm text-stone-500">{formatAnnivDate(item.date)} ({getDDay(item.date)})</div>
                  </div>
                  <button
                    onClick={() => startEdit(item)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-orange-50 hover:text-[#7b310d]"
                    aria-label="기념일 수정"
                  >
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-500" aria-label="기념일 삭제">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={startAdd} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#7b310d] font-bold text-white">
            <Plus size={18} /> 기념일 추가
          </button>
        </>
      )}

      {mode === "add" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => { resetForm(); setMode("manage"); }}><ChevronLeft /></button>
            <h1 className="font-black">{editingId ? "기념일 수정" : "기념일 추가"}</h1>
            <div className="w-10" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold">이름</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 어머니, 친구 민수"
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">날짜</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">종류</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="h-12 w-full rounded-md border border-stone-200 px-4 outline-none focus:border-[#7b310d]"
              >
                {Object.entries(ANNIV_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{ANNIV_TYPE_ICONS[k]} {v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">메모 (선택)</label>
              <textarea
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="기념일에 전하고 싶은 말을 적어보세요."
                className="min-h-24 w-full rounded-md border border-stone-200 p-4 outline-none focus:border-[#7b310d] leading-6"
              />
            </div>
            <PrimaryButton onClick={handleSave} disabled={!newName.trim() || !newDate || saving}>
              {saving ? "저장 중..." : editingId ? "수정 저장" : "저장"}
            </PrimaryButton>
            {editingId && (
              <button
                onClick={() => { resetForm(); setMode("manage"); }}
                className="h-12 w-full rounded-md border border-stone-200 font-bold text-stone-600"
              >
                수정 취소
              </button>
            )}
          </div>
        </>
      )}
    </PhoneShell>
  );
}

function AnnivAction({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-orange-50 text-[#7b310d]">{icon}</span>
      <span><strong>{title}</strong><span className="mt-1 block text-sm text-stone-600">{text}</span></span>
    </button>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "홈", icon: Home },
    { href: "/anniversaries", label: "기념일", icon: CalendarDays },
    { href: "/create/background", label: "카드 만들기", icon: Pencil },
    { href: "/library", label: "보관함", icon: Folder },
    { href: "/mypage", label: "마이페이지", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[calc(4.75rem+env(safe-area-inset-bottom))] w-full max-w-md grid-cols-5 rounded-t-xl border-t border-outline-variant/30 bg-surface-container-low/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur-lg sm:h-20 sm:max-w-2xl sm:pb-0 lg:max-w-5xl">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-center text-[11px] font-semibold leading-tight tracking-normal transition active:scale-95 sm:text-xs ${
              active
                ? "bg-secondary-container/40 text-primary"
                : "text-on-surface-variant opacity-70 hover:bg-surface-variant/50"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.6 : 2} fill={active && href === "/" ? "currentColor" : "none"} />
            <span className="block w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
