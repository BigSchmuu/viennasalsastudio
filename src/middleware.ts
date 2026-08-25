import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const handleI18n = createIntlMiddleware(routing);

/**
 * Zwei Aufgaben in einer Anfrage (PROJ-43): die Sprache bestimmen und die
 * Supabase-Sitzung auffrischen.
 *
 * Die Reihenfolge ist nicht beliebig. Die Sprachweiche entscheidet zuerst — sie
 * kann umleiten (`/kurse` → `/en/kurse`), und dann braucht es die Sitzung gar
 * nicht. Kommt sie ohne Umleitung zurück, schreibt die Sitzungsauffrischung
 * ihre Cookies auf *deren* Antwort. Umgekehrt ginge eines von beidem verloren.
 *
 * Mitarbeiterbereiche (/admin, /lehrer, /checkin) und die Schnittstellen sind
 * unten ausgenommen: sie haben keine Sprachebene, brauchen aber die Sitzung.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ohneSprachebene =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/lehrer") ||
    pathname.startsWith("/checkin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth");

  if (ohneSprachebene) {
    return await updateSession(request);
  }

  const intlResponse = handleI18n(request);

  // Eine Umleitung der Sprachweiche wird nicht überschrieben — die Sitzung
  // wird beim Folgeaufruf ohnehin aufgefrischt.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  return await updateSession(request, intlResponse as NextResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
