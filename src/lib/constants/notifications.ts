export const notificationEventGroupValues = [
  "buchungsstatus",
  "warteliste",
  "abo_kuendigung",
  "kursstart_erinnerung",
  "event_tickets",
  "probestunde_nachfassung",
  "empfehlung",
  "newsletter",
] as const;
export type NotificationEventGroup = (typeof notificationEventGroupValues)[number];

export const notificationChannelValues = ["email", "push"] as const;
export type NotificationChannel = (typeof notificationChannelValues)[number];

/** Groups with no push option at all (PROJ-28: newsletter is email-only by spec). */
export const notificationEmailOnlyGroups: readonly NotificationEventGroup[] = ["newsletter"];

export const notificationEventGroupLabel: Record<NotificationEventGroup, string> = {
  buchungsstatus: "Buchungsstatus",
  warteliste: "Warteliste rückt nach",
  abo_kuendigung: "Abo-Kündigung wirksam",
  kursstart_erinnerung: "Kursstart-Erinnerung",
  event_tickets: "Event-Tickets",
  probestunde_nachfassung: "Probestunden-Nachfassung",
  empfehlung: "Empfehlung hat gezählt",
  newsletter: "Newsletter",
};

export const notificationEventGroupDescription: Record<NotificationEventGroup, string> = {
  buchungsstatus: "Deine Buchungsanfrage wurde bestätigt oder abgelehnt",
  warteliste: "Du rückst automatisch von der Warteliste nach",
  abo_kuendigung: "Eine geplante Kündigung oder Pausierung wird wirksam",
  kursstart_erinnerung: "Erinnerung am Vortag einer Probestunde oder eines Drop-ins",
  event_tickets: "Dein Event-Ticket wurde bestätigt oder das Event wurde abgesagt",
  probestunde_nachfassung: "Erinnerung nach einer Probestunde, mit direktem Buchungslink",
  empfehlung: "Jemand hat mit deinem Empfehlungscode gebucht und du bekommst Guthaben",
  newsletter: "Ankündigungen und Aktionen des Studios",
};
