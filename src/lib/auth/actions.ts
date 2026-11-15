"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserWithProfile } from "@/types/database";

export async function signInWithGitHub(redirectPath?: string) {
  const supabase = await createClient();

  const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`);
  if (redirectPath) {
    callbackUrl.searchParams.set("next", redirectPath);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithGoogle(redirectPath?: string) {
  const supabase = await createClient();

  const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`);
  if (redirectPath) {
    callbackUrl.searchParams.set("next", redirectPath);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function getUser(): Promise<UserWithProfile | null> {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return { profile: profile as Profile };
}

export async function canCreateBundle(): Promise<{ allowed: boolean; reason?: string }> {
  const userData = await getUser();

  if (!userData) {
    return { allowed: false, reason: "Not authenticated" };
  }

  return { allowed: true };
}
