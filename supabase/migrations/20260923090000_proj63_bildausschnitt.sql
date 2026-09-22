-- PROJ-63: Welcher Teil des Titelbilds auf der Karte zu sehen ist.
--
-- Die Karte in der Übersicht zeigt das Titelbild im festen Querformat 16:9 und
-- schnitt bisher immer mittig zu. Bei einem hochformatigen Flyer fielen damit
-- Titel und Datum weg.
--
-- Eine Zahl genügt für beide Fälle: Ob oben/unten oder links/rechts
-- abgeschnitten wird, ergibt sich aus `width` und `height`, die seit PROJ-55
-- ohnehin an jedem Bild stehen. 0 = oberer bzw. linker Rand, 50 = mittig (das
-- bisherige Verhalten), 100 = unterer bzw. rechter Rand.
--
-- Der Wert gehört zum Bild, nicht zum Event: Wird das Titelbild ersetzt, geht
-- er mit dem alten Bild und das neue beginnt wieder mittig.
--
-- Keine neue Schreibregel: `event_images` darf bereits nur die Verwaltung
-- ändern (Policy "EventImages: admin update" aus PROJ-55). Die neue Spalte
-- erbt das.

alter table public.event_images
  add column focus_percent int not null default 50
  constraint event_images_focus_percent_bereich check (focus_percent between 0 and 100);

comment on column public.event_images.focus_percent is
  'PROJ-63: Lage des sichtbaren Ausschnitts auf der Karte, 0-100, Standard 50 (mittig). Richtung ergibt sich aus width/height.';
