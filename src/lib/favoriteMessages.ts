import { createClient } from "@/lib/supabase/client";

export interface FavoriteMessage {
  id: string;
  text: string;
  purpose: string | null;
  created_at: string;
}

export async function getFavoriteMessages(): Promise<FavoriteMessage[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("favorite_messages")
    .select("id, text, purpose, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as FavoriteMessage[];
}

export async function addFavoriteMessage(text: string, purpose?: string): Promise<FavoriteMessage | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("favorite_messages")
    .insert({ text, purpose: purpose ?? null, user_id: user.id })
    .select("id, text, purpose, created_at")
    .single();
  return data as FavoriteMessage | null;
}

export async function deleteFavoriteMessage(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("favorite_messages").delete().eq("id", id);
}
