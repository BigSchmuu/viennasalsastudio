import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricTile({
  label,
  value,
  secondaryLabel,
}: {
  label: string;
  value: string;
  secondaryLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-3xl">{value}</CardTitle>
      </CardHeader>
      {secondaryLabel && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">{secondaryLabel}</p>
        </CardContent>
      )}
    </Card>
  );
}
