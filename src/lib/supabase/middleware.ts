import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { locales, defaultLocale } from "@/i18n/routing";

/**
 * Erneuert die Supabase-Sitzung und schreibt die aufgefrischten Cookies auf
 * `baseResponse`.
 *
 * PROJ-43: Der Parameter ist neu. Vorher erzeugte diese Funktion ihre eigene
 * Antwort; seit die Sprachweiche davorsteht, muss sie auf deren Antwort
 * schreiben — sonst ginge entweder die Sprachumleitung oder die aufgefrischte
 * Sitzung verloren, je nachdem, welche Antwort zuletzt zurückkommt.
 */
export async function updateSession(request: NextRequest, baseResponse?: NextResponse) {
  let supabaseResponse = baseResponse ?? NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Die Antwort der Sprachweiche behalten, statt sie zu ersetzen:
          // sie trägt die Umschreibung auf /de/… und das Sprach-Cookie.
          if (!baseResponse) {
            supabaseResponse = NextResponse.next({ request });
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add logic between createServerClient and getUser() — refreshing
  // the session here is what keeps users from being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // PROJ-43: /profil ist geschützt — und /en/profil genauso. Die Sprache wird
  // für die Prüfung abgetrennt und für die Umleitung wieder angehängt, damit
  // ein englischer Kunde nicht auf der deutschen Login-Seite landet.
  const { pathname } = request.nextUrl;
  const segmente = pathname.split("/").filter(Boolean);
  const sprachPraefix = locales.includes(segmente[0] as (typeof locales)[number])
    ? (segmente[0] as (typeof locales)[number])
    : null;
  const pfadOhneSprache = sprachPraefix ? `/${segmente.slice(1).join("/")}` : pathname;

  const protectedPaths = ["/profil"];
  const isProtected = protectedPaths.some((path) => pfadOhneSprache.startsWith(path));

  if (isProtected && !user) {
    const praefix = sprachPraefix && sprachPraefix !== defaultLocale ? `/${sprachPraefix}` : "";
    const redirectUrl = new URL(`${praefix}/login`, request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
