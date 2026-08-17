// Known Web Push service origins. The server later makes an HTTP request
// directly to whatever endpoint a client submits (via subscribeToPush), so
// without this allowlist any authenticated customer could point their own
// "subscription" at an arbitrary internal or external URL and have the
// server POST notification content to it on every future send (SSRF).
const TRUSTED_PUSH_HOSTNAMES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];

const TRUSTED_PUSH_HOSTNAME_SUFFIXES = [".notify.windows.com"];

export function isTrustedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  return (
    TRUSTED_PUSH_HOSTNAMES.includes(url.hostname) ||
    TRUSTED_PUSH_HOSTNAME_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
  );
}
