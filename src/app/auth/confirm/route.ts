import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/profil";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // `next` may be a full URL (from the Supabase email template's
      // {{ .RedirectTo }} variable) or a relative path — both are accepted,
      // but only when they stay on our own origin. An attacker-supplied
      // external `next` would otherwise turn a valid confirmation link into
      // an open redirect.
      const destination = safeRedirectPath(next, "/profil", origin);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
