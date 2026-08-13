import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      // {{ .RedirectTo }} variable) or a relative path — handle both.
      const destination = next.startsWith("http") ? next : `${origin}${next}`;
      return NextResponse.redirect(destination);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
