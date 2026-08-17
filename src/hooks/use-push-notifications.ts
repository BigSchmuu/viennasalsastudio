"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/actions/notifications";

type PushStatus = "checking" | "unsupported" | "inactive" | "active";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "active" : "inactive"))
      .catch(() => setStatus("inactive"));
  }, []);

  const activate = useCallback(async (): Promise<{ error?: string }> => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return { error: "Push ist derzeit nicht konfiguriert." };

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { error: "Push-Berechtigung wurde nicht erteilt." };
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return { error: "Push-Registrierung ist unvollständig." };
      }

      const result = await subscribeToPush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if ("error" in result) return { error: result.error };

      setStatus("active");
      return {};
    } catch {
      return { error: "Push-Benachrichtigungen konnten nicht aktiviert werden." };
    } finally {
      setBusy(false);
    }
  }, []);

  const deactivate = useCallback(async (): Promise<{ error?: string }> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setStatus("inactive");
        return {};
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const result = await unsubscribeFromPush(endpoint);
      if ("error" in result) return { error: result.error };

      setStatus("inactive");
      return {};
    } catch {
      return { error: "Push-Benachrichtigungen konnten nicht deaktiviert werden." };
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, activate, deactivate };
}
