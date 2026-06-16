import { create } from "zustand";
import type { CardEditorState, CardPurpose } from "@/types/card";

interface CardEditorStore extends CardEditorState {
  setPurpose: (purpose: CardPurpose) => void;
  setMessage: (message: string) => void;
  setBackground: (url: string, isAi: boolean) => void;
  reset: () => void;
}

const initialState: CardEditorState = {
  purpose: null,
  message: "",
  backgroundUrl: null,
  isAiGenerated: false,
};

export const useCardEditorStore = create<CardEditorStore>((set) => ({
  ...initialState,
  setPurpose: (purpose) => set({ purpose }),
  setMessage: (message) => set({ message }),
  setBackground: (backgroundUrl, isAiGenerated) =>
    set({ backgroundUrl, isAiGenerated }),
  reset: () => set(initialState),
}));
