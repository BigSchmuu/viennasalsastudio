"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export type TrendPoint = { key: string; label: string; value: number };

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export function TrendChart({
  title,
  data,
  color,
  valueLabel,
  valueFormat = "number",
}: {
  title: string;
  data: TrendPoint[];
  color: string;
  valueLabel: string;
  valueFormat?: "currency" | "number";
}) {
  const hasData = data.some((d) => d.value > 0);
  const config: ChartConfig = { value: { label: valueLabel, color } };
  const formatValue = (value: number) => (valueFormat === "currency" ? EUR.format(value) : String(value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} />
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
