import type { ReactNode } from "react";

/**
 * Gemeinsamer Rahmen für die Abschnitte des Dashboards.
 *
 * Die Regel des Dashboards lautet: ein Abschnitt, der nichts zu sagen hat,
 * erscheint gar nicht. Diese Komponente setzt sie durch — wer keine Kinder
 * übergibt, bekommt auch keine Überschrift.
 */
export function DashboardSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
