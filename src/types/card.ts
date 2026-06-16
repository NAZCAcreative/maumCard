export type CardPurpose =
  | "birthday"
  | "gratitude"
  | "love"
  | "cheer"
  | "comfort"
  | "congratulation"
  | "anniversary"
  | "etc";

export interface Card {
  id: string;
  userId: string;
  purpose: CardPurpose;
  message: string;
  backgroundUrl: string;
  isAiGenerated: boolean;
  shareUrl?: string;
  createdAt: string;
}

export interface CardEditorState {
  purpose: CardPurpose | null;
  message: string;
  backgroundUrl: string | null;
  isAiGenerated: boolean;
}
