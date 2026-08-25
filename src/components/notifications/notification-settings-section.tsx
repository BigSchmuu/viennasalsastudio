"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { setNotificationPreference } from "@/lib/actions/notifications";
import { useTranslations } from "next-intl";
import {
  notificationEventGroupValues,
  notificationChannelValues,
  notificationEmailOnlyGroups,
  type NotificationEventGroup,
  type NotificationChannel,
} from "@/lib/constants/notifications";

export type NotificationPreferenceRow = {
  eventGroup: NotificationEventGroup;
  channel: NotificationChannel;
  enabled: boolean;
};

function buildPreferenceMap(rows: NotificationPreferenceRow[]) {
  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(`${row.eventGroup}:${row.channel}`, row.enabled);
  }
  return map;
}

export function NotificationSettingsSection({
  preferences: initialPreferences,
}: {
  preferences: NotificationPreferenceRow[];
}) {
  const t = useTranslations("notifications");
  const [preferenceMap, setPreferenceMap] = useState(buildPreferenceMap(initialPreferences));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const push = usePushNotifications();

  function isEnabled(eventGroup: NotificationEventGroup, channel: NotificationChannel) {
    const key = `${eventGroup}:${channel}`;
    return preferenceMap.has(key) ? preferenceMap.get(key)! : true;
  }

  function handleToggle(eventGroup: NotificationEventGroup, channel: NotificationChannel, next: boolean) {
    const key = `${eventGroup}:${channel}`;
    const previous = isEnabled(eventGroup, channel);
    setPreferenceMap((prev) => new Map(prev).set(key, next));
    setPendingKey(key);

    startTransition(async () => {
      const result = await setNotificationPreference(eventGroup, channel, next);
      setPendingKey(null);
      if ("error" in result) {
        setPreferenceMap((prev) => new Map(prev).set(key, previous));
        toast.error(result.error);
      }
    });
  }

  async function handleActivatePush() {
    const result = await push.activate();
    if (result.error) toast.error(result.error);
    else toast.success(t("pushEnabled"));
  }

  async function handleDeactivatePush() {
    const result = await push.deactivate();
    if (result.error) toast.error(result.error);
  }

  const pushReady = push.status === "active";

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3 text-sm">
        {push.status === "checking" && <p className="text-muted-foreground">{t("pushChecking")}</p>}
        {push.status === "unsupported" && (
          <p className="text-muted-foreground">
            {t("pushUnsupported")}
          </p>
        )}
        {push.status === "inactive" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">{t("pushInactive")}</p>
            <Button type="button" size="sm" disabled={push.busy} onClick={handleActivatePush}>
              {push.busy ? t("pushEnabling") : t("pushEnable")}
            </Button>
          </div>
        )}
        {push.status === "active" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">{t("pushActive")}</p>
            <Button type="button" size="sm" variant="outline" disabled={push.busy} onClick={handleDeactivatePush}>
              {push.busy ? t("pushDisabling") : t("pushDisable")}
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("event")}</TableHead>
              <TableHead className="text-center">{t("email")}</TableHead>
              <TableHead className="text-center">{t("push")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notificationEventGroupValues.map((eventGroup) => (
              <TableRow key={eventGroup}>
                <TableCell>
                  <p className="font-medium">{t(`group.${eventGroup}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`groupHint.${eventGroup}`)}</p>
                </TableCell>
                {notificationChannelValues.map((channel) => {
                  if (channel === "push" && notificationEmailOnlyGroups.includes(eventGroup)) {
                    return (
                      <TableCell key={channel} className="text-center text-muted-foreground">
                        —
                      </TableCell>
                    );
                  }
                  const key = `${eventGroup}:${channel}`;
                  const disabled = (channel === "push" && !pushReady) || pendingKey === key;
                  return (
                    <TableCell key={channel} className="text-center">
                      <Switch
                        checked={isEnabled(eventGroup, channel)}
                        disabled={disabled}
                        onCheckedChange={(checked) => handleToggle(eventGroup, channel, checked)}
                        aria-label={`${t(`group.${eventGroup}`)} — ${channel === "email" ? t("email") : t("push")}`}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("sepaNote")}
      </p>
    </div>
  );
}
