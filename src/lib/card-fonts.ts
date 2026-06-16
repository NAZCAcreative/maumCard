// 카드 폰트 레지스트리 (클라이언트/서버 공용, sharp 비의존).
// public/fonts/*.ttf 와 매핑. id는 draft.cardFont 값으로 저장됨.
export type CardFontDef = {
  id: string;
  label: string; // UI 표시명
  file: string; // public/fonts/ 내 파일명
  family: string; // satori 폰트 패밀리명 (고유)
  group: "손글씨" | "명조" | "고딕" | "디자인"; // 분류
};

export const CARD_FONTS: CardFontDef[] = [
  // 손글씨
  { id: "pen", label: "나눔펜", file: "NanumPenScript-Regular.ttf", family: "cf_pen", group: "손글씨" },
  { id: "brush", label: "나눔붓", file: "NanumBrushScript-Regular.ttf", family: "cf_brush", group: "손글씨" },
  { id: "gamja", label: "감자꽃", file: "GamjaFlower-Regular.ttf", family: "cf_gamja", group: "손글씨" },
  { id: "himelody", label: "하이멜로디", file: "HiMelody-Regular.ttf", family: "cf_himelody", group: "손글씨" },
  { id: "poorstory", label: "푸어스토리", file: "PoorStory-Regular.ttf", family: "cf_poorstory", group: "손글씨" },
  { id: "gaegu", label: "개구", file: "Gaegu-Regular.ttf", family: "cf_gaegu", group: "손글씨" },
  { id: "gaegubold", label: "개구 굵게", file: "Gaegu-Bold.ttf", family: "cf_gaegubold", group: "손글씨" },
  { id: "cutefont", label: "귀여운", file: "CuteFont-Regular.ttf", family: "cf_cutefont", group: "손글씨" },
  { id: "dokdo", label: "독도", file: "Dokdo-Regular.ttf", family: "cf_dokdo", group: "손글씨" },
  { id: "eastsea", label: "동해독도", file: "EastSeaDokdo-Regular.ttf", family: "cf_eastsea", group: "손글씨" },
  { id: "kirang", label: "기랑해랑", file: "KirangHaerang-Regular.ttf", family: "cf_kirang", group: "손글씨" },
  { id: "singleday", label: "싱글데이", file: "SingleDay-Regular.ttf", family: "cf_singleday", group: "손글씨" },
  { id: "yeonsung", label: "연성", file: "YeonSung-Regular.ttf", family: "cf_yeonsung", group: "손글씨" },
  // 명조
  { id: "serif", label: "고운바탕", file: "GowunBatang-Regular.ttf", family: "cf_serif", group: "명조" },
  { id: "nanummyeongjo", label: "나눔명조", file: "NanumMyeongjo-Regular.ttf", family: "cf_nanummyeongjo", group: "명조" },
  { id: "songmyung", label: "송명", file: "SongMyung-Regular.ttf", family: "cf_songmyung", group: "명조" },
  { id: "diphylleia", label: "디필레이아", file: "Diphylleia-Regular.ttf", family: "cf_diphylleia", group: "명조" },
  { id: "stylish", label: "스타일리시", file: "Stylish-Regular.ttf", family: "cf_stylish", group: "명조" },
  // 고딕
  { id: "nanumgothic", label: "나눔고딕", file: "NanumGothic-Regular.ttf", family: "cf_nanumgothic", group: "고딕" },
  { id: "gowundodum", label: "고운돋움", file: "GowunDodum-Regular.ttf", family: "cf_gowundodum", group: "고딕" },
  { id: "gothica1", label: "고딕A1", file: "GothicA1-Regular.ttf", family: "cf_gothica1", group: "고딕" },
  { id: "nanumcoding", label: "나눔코딩", file: "NanumGothicCoding-Regular.ttf", family: "cf_nanumcoding", group: "고딕" },
  { id: "sunflower", label: "해바라기", file: "Sunflower-Medium.ttf", family: "cf_sunflower", group: "고딕" },
  // 디자인 (강조/제목용)
  { id: "blackhan", label: "검은고딕", file: "BlackHanSans-Regular.ttf", family: "cf_blackhan", group: "디자인" },
  { id: "dohyeon", label: "도현", file: "DoHyeon-Regular.ttf", family: "cf_dohyeon", group: "디자인" },
  { id: "jua", label: "주아", file: "Jua-Regular.ttf", family: "cf_jua", group: "디자인" },
  { id: "gugi", label: "구기", file: "Gugi-Regular.ttf", family: "cf_gugi", group: "디자인" },
  { id: "bwpicture", label: "흑백사진", file: "BlackAndWhitePicture-Regular.ttf", family: "cf_bwpicture", group: "디자인" },
];

export const CARD_FONT_MAP: Record<string, CardFontDef> = Object.fromEntries(
  CARD_FONTS.map((f) => [f.id, f]),
);

export const DEFAULT_CARD_FONT = "pen";

export function resolveCardFontId(id: string | undefined): string {
  return id && CARD_FONT_MAP[id] ? id : DEFAULT_CARD_FONT;
}
