-- PROJ-43: Angepasste Benachrichtigungs-Vorlagen gibt es jetzt je Sprache.
--
-- Ohne die Sprache im Schluessel koennte der Betreiber nur eine der beiden
-- Fassungen anpassen, und die andere fiele stillschweigend auf die Vorlage im
-- Code zurueck.
--
-- Der Zeitpunkt ist guenstig: es gibt derzeit null angepasste Vorlagen, die
-- Umstellung kostet also keine Daten. Bestehende Zeilen bekaemen 'de'.
alter table public.notification_template_overrides
  add column if not exists language text not null default 'de'
    check (language in ('de', 'en'));

alter table public.notification_template_overrides
  drop constraint if exists notification_template_overrides_pkey;

alter table public.notification_template_overrides
  add primary key (template_key, language);

comment on column public.notification_template_overrides.language is
  'PROJ-43: Sprache dieser Anpassung. Die Fassung fuer die andere Sprache steht in einer eigenen Zeile.';
