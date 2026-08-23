-- PROJ-41: Die Preisliste des Studios führt künftig auch Abo- und
-- Flatrate-Preise. Sie liegen bewusst in derselben Zeile wie die
-- Drop-in-Preise: ein zweiter Ort für Preise wäre eine weitere Stelle zum
-- Vergessen. Der Tabellenname bleibt ein Überbleibsel aus der Zeit, als hier
-- nur Drop-ins standen.
--
-- Nullable, weil ein leerer Preis "noch nicht gepflegt" heißt und nicht
-- "kostenlos" — der Buchungsdialog zeigt dann einen Hinweis statt 0,00 €.
alter table public.dropin_pricing
  add column if not exists course_price numeric
    check (course_price > 0 and course_price <= 1000),
  add column if not exists course_student_price numeric
    check (course_student_price > 0 and course_student_price <= 1000),
  add column if not exists flatrate_price numeric
    check (flatrate_price > 0 and flatrate_price <= 1000),
  add column if not exists flatrate_student_price numeric
    check (flatrate_student_price > 0 and flatrate_student_price <= 1000);

comment on column public.dropin_pricing.course_price is
  'PROJ-41: Standardpreis pro Monat für ein Kursabo. Gilt für jeden Kurs ohne eigenen Preis (courses.price).';
comment on column public.dropin_pricing.flatrate_price is
  'PROJ-41: Preis pro Monat für die Flatrate über alle Kurse.';

-- Startwerte laut Spec. Nur setzen, wo noch nichts steht, damit ein erneutes
-- Ausführen der Migration keine gepflegten Preise überschreibt.
update public.dropin_pricing
set course_price = coalesce(course_price, 65),
    course_student_price = coalesce(course_student_price, 45),
    flatrate_price = coalesce(flatrate_price, 145),
    flatrate_student_price = coalesce(flatrate_student_price, 100);
