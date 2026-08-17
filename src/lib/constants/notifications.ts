export const notificationEventGroupValues = [
  "buchungsstatus",
  "warteliste",
  "abo_kuendigung",
  "kursstart_erinnerung",
] as const;
export type NotificationEventGroup = (typeof notificationEventGroupValues)[number];

export const notificationChannelValues = ["email", "push"] as const;
export type NotificationChannel = (typeof notificationChannelValues)[number];

export const notificationEventGroupLabel: Record<NotificationEventGroup, string> = {
  buchungsstatus: "Buchungsstatus",
  warteliste: "Warteliste rückt nach",
  abo_kuendigung: "Abo-Kündigung wirksam",
  kursstart_erinnerung: "Kursstart-Erinnerung",
};

export const notificationEventGroupDescription: Record<NotificationEventGroup, string> = {
  buchungsstatus: "Deine Buchungsanfrage wurde bestätigt oder abgelehnt",
  warteliste: "Du rückst automatisch von der Warteliste nach",
  abo_kuendigung: "Eine geplante Kündigung oder Pausierung wird wirksam",
  kursstart_erinnerung: "Erinnerung am Vortag einer Probestunde oder eines Drop-ins",
};
