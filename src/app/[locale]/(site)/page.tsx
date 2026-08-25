import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="font-heading text-4xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/kurse">{t("viewCourses")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/stundenplan">{t("viewSchedule")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">{t("login")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
