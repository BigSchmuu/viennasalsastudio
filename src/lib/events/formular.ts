/**
 * Ein Zeitpunkt als Wert für ein `datetime-local`-Feld — in der Ortszeit des
 * Browsers, denn genau so liest und schreibt das Feld.
 *
 * Steht hier und nicht zweimal in den Formularen: Event und Serientermin
 * brauchen dieselbe Umrechnung.
 */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
