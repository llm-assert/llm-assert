"use server";

import { createClient } from "@/lib/supabase/server";

export async function signUp(
  _prevState: { error: string; success: boolean } | null,
  formData: FormData,
) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required.", success: false };
  }

  if (password.length < 8) {
    return {
      error: "Password must be at least 8 characters.",
      success: false,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // Use generic message to prevent account enumeration —
    // Supabase errors can reveal whether an email is already registered.
    return {
      error: "Could not create account. Please try again.",
      success: false,
    };
  }

  return {
    error: "",
    success: true,
  };
}
