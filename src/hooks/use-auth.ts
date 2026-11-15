"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  profile: null,
  isLoading: true,
};

let authState: AuthState = INITIAL_AUTH_STATE;
const listeners = new Set<(state: AuthState) => void>();
let requestId = 0;
let isInitialized = false;

function emit(next: AuthState) {
  authState = next;
  for (const listener of listeners) {
    listener(next);
  }
}

async function fetchUserData(user: User | null, currentRequestId: number) {
  if (!user) {
    if (currentRequestId === requestId) {
      emit({ user: null, profile: null, isLoading: false });
    }
    return;
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (currentRequestId !== requestId) {
    return;
  }

  emit({
    user,
    profile: profile as Profile | null,
    isLoading: false,
  });
}

function initializeAuthStore() {
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  const supabase = createClient();

  const initialRequestId = ++requestId;
  supabase.auth.getUser().then(({ data: { user } }) => {
    fetchUserData(user, initialRequestId);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const nextRequestId = ++requestId;
    fetchUserData(session?.user ?? null, nextRequestId);
  });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    initializeAuthStore();
    listeners.add(setState);

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
