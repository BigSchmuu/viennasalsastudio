/**
 * Resolves a user-supplied post-auth redirect target to a safe, same-origin
 * path.
 *
 * Both the login form and the e-mail confirmation route take their
 * destination straight from a query parameter, which an attacker controls.
 * Without this, a link to our *real* domain could bounce the user to a
 * phishing page right after a genuine login — the classic open-redirect
 * setup ("Sitzung abgelaufen, bitte erneut einloggen").
 *
 * Always returns a root-relative path, never an absolute URL.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
  origin?: string
): string {
  if (!value) return fallback;

  // Browsers strip control characters (tab, newline, NUL…) before parsing a
  // URL, so "/\tevil.com" can become "//evil.com" — an external origin.
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;

  // An absolute (or protocol-relative) URL is only acceptable when it points
  // at our own origin — Supabase's e-mail template passes {{ .RedirectTo }}
  // as a full URL, so this path has to keep working.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    if (!origin) return fallback;
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin) return fallback;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return fallback;
    }
  }

  // Otherwise it must be a plain root-relative path. "/\host" is rejected too:
  // browsers normalise the backslash and treat it as protocol-relative.
  if (!value.startsWith("/") || value.startsWith("/\\")) return fallback;

  return value;
}
