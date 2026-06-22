import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/supabase";

export interface CardInsertData {
  purpose: string;
  recipient: string;
  honorific?: string;
  message: string;
  background_id: string;
  is_ai_bg?: boolean;
  card_image_url?: string | null;
  editor_state?: Json;
}

export async function saveCard(data: CardInsertData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const payload = {
    user_id: user.id,
    purpose: data.purpose,
    recipient: data.recipient,
    honorific: data.honorific ?? "에게",
    message: data.message,
    background_id: data.background_id,
    is_ai_bg: data.is_ai_bg ?? false,
    card_image_url: data.card_image_url ?? null,
    compose_mode: data.editor_state
      ? `editor:${JSON.stringify(data.editor_state)}`
      : "short",
    share_token: crypto.randomUUID(),
  };
  const { data: card, error } = await supabase
    .from("card_library")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return card;
}

export async function getMyCards() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("card_library")
    .select("*")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function toggleFavorite(cardId: string, isFavorite: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("card_library")
    .update({ is_favorite: isFavorite })
    .eq("id", cardId);

  if (error) throw error;
}

export async function updateCardImageUrl(cardId: string, cardImageUrl: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("card_library")
    .update({ card_image_url: cardImageUrl })
    .eq("id", cardId);

  if (error) throw error;
}

export async function deleteCard(cardId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("card_library")
    .update({ is_hidden: true })
    .eq("id", cardId);

  if (error) throw error;
}

export async function hardDeleteCard(cardId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("card_library")
    .delete()
    .eq("id", cardId);

  if (error) throw error;
}

export async function deleteAllCards() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("card_library")
    .update({ is_hidden: true })
    .eq("user_id", user.id);

  if (error) throw error;
}

export async function getCardByShareToken(token: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("card_library")
    .select("*")
    .eq("share_token", token)
    .eq("is_hidden", false)
    .single();

  if (error) return null;
  return data;
}
