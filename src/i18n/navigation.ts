import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Ersatz für Link, useRouter und Co. im Kundenbereich (PROJ-43).
 *
 * Diese Varianten hängen die Sprache selbst an die Adresse. Ein gewöhnliches
 * `next/link` würde einen englischen Besucher beim ersten Klick zurück ins
 * Deutsche werfen.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
