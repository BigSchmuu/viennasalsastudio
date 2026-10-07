"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type TrendPoint = {
  key: string;
  label: string;
  value: number;
  /** PROJ-76: nur gesetzt, wenn der Graph eine zweite Reihe zeigt. */
  secondValue?: number;
};

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

/**
 * Ein Verlaufsgraph mit einer oder zwei Reihen.
 *
 * PROJ-76: Die zweite Reihe steht daneben, nicht darüber — gestapelt wäre die
 * Summe ablesbar und die einzelne Zahl nicht, und hier geht es um den Vergleich
 * zweier Zahlen. Ab zwei Reihen gehört eine Legende dazu; bei einer einzigen
 * nennt der Titel sie, und ein Kästchen daneben wäre nur Rauschen.
 */
export function TrendChart({
  title,
  data,
  color,
  valueLabel,
  valueFormat = "number",
  secondSeries,
}: {
  title: string;
  data: TrendPoint[];
  color: string;
  valueLabel: string;
  valueFormat?: "currency" | "number";
  /** Die zweite Reihe; ihre Werte stehen als `secondValue` an den Punkten. */
  secondSeries?: { label: string; color: string };
}) {
  const hasData = data.some((d) => d.value > 0 || (d.secondValue ?? 0) > 0);
  const config: ChartConfig = secondSeries
    ? {
        value: { label: valueLabel, color },
        secondValue: { label: secondSeries.label, color: secondSeries.color },
      }
    : { value: { label: valueLabel, color } };
  const formatValue = (value: number) => (valueFormat === "currency" ? EUR.format(value) : String(value));
  // Ein benannter Bereich: Auf dem Dashboard stehen mehrere Karten, und ein
  // Screenreader kann sie sonst nicht auseinanderhalten. Der Name ist der Titel
  // selbst — kein zweiter, abweichender Text.
  const titelId = useId();

  return (
    <Card role="region" aria-labelledby={titelId}>
      <CardHeader>
        <CardTitle id={titelId} className="font-heading text-lg">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            {/* `barGap={2}`: zwei Pixel Fläche zwischen den Balken eines
                Zeitraums, damit sie sich nicht berühren und als zwei Werte
                lesbar bleiben. */}
            <BarChart data={data} barGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />} />
              {secondSeries && <ChartLegend content={<ChartLegendContent />} />}
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              {secondSeries && <Bar dataKey="secondValue" fill="var(--color-secondValue)" radius={4} />}
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Noch keine Daten für diesen Zeitraum
          </div>
        )}
      </CardContent>
    </Card>
  );
}
