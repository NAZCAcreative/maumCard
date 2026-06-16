import { createClient } from "@/lib/supabase/client";

function getAuthRedirectTo() {
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const params = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const next = params?.get("next") ?? "/";

  return origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;
}

export async function redirectToGoogleLogin() {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectTo(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) throw error;
}

export async function sendEmailLoginLink(email: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthRedirectTo(),
      shouldCreateUser: true,
    },
  });

  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}
