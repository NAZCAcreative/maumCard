import { createClient } from "@/lib/supabase/client";

export interface AnniversaryInsertData {
  name: string;
  date: string;
  anniversary_type?: string;
  notify_days_before?: number[];
  memo?: string;
}

export interface AnniversaryUpdateData extends AnniversaryInsertData {
  id: string;
}

export async function getAnniversaries() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("anniversaries")
    .select("*")
    .order("date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createAnniversary(data: AnniversaryInsertData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: anniversary, error } = await supabase
    .from("anniversaries")
    .insert({
      user_id: user.id,
      name: data.name,
      date: data.date,
      anniversary_type: data.anniversary_type ?? "birthday",
      notify_days_before: data.notify_days_before ?? [7, 1],
      memo: data.memo,
    })
    .select()
    .single();

  if (error) throw error;
  return anniversary;
}

export async function updateAnniversary(data: AnniversaryUpdateData) {
  const supabase = createClient();
  const { data: anniversary, error } = await supabase
    .from("anniversaries")
    .update({
      name: data.name,
      date: data.date,
      anniversary_type: data.anniversary_type ?? "birthday",
      notify_days_before: data.notify_days_before ?? [7, 1],
      memo: data.memo ?? null,
    })
    .eq("id", data.id)
    .select()
    .single();

  if (error) throw error;
  return anniversary;
}

export async function deleteAnniversary(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("anniversaries")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
