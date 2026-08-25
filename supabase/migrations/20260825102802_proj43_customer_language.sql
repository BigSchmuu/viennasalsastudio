-- PROJ-43: Die bevorzugte Sprache des Kunden.
--
-- Nicht nur ein Cookie, weil E-Mails und Push-Nachrichten entstehen, wenn
-- niemand vor dem Bildschirm sitzt — beim naechtlichen Versand, beim
-- Bestaetigen durch den Betreiber. In dem Moment gibt es keine "gerade
-- eingestellte Sprache"; nur was hier steht, ist dann noch da.
--
-- Nullable und ohne Vorbelegung: die 52 Bestandskunden nutzen die App auf
-- Deutsch. Sie ungefragt umzustellen waere eine Aenderung, um die niemand
-- gebeten hat — leer heisst schlicht "wie bisher".
alter table public.profiles
  add column if not exists language text
    check (language is null or language in ('de', 'en'));

comment on column public.profiles.language is
  'PROJ-43: Bevorzugte Sprache des Kunden (de/en). NULL = nie gewaehlt, es gilt Deutsch.';
