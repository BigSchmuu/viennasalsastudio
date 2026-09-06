-- PROJ-47: Der Lastschriftlauf bekommt einen Zeitpunkt, an dem er verbindlich
-- wird. Ist er leer, ist der Lauf ein Entwurf.
--
-- Der Zustand steht hier und wird nicht daraus abgeleitet, ob es Rechnungen zu
-- diesem Lauf gibt. Eine Ableitung waere eine zweite Wahrheit: schluege die
-- Rechnungserstellung fehl, gaelte der Lauf wieder als Entwurf, obwohl die
-- Kunden schon benachrichtigt sind.
alter table public.sepa_collection_runs
  add column released_at timestamptz,
  add column released_by uuid references auth.users(id);

comment on column public.sepa_collection_runs.released_at is
  'PROJ-47: Zeitpunkt der Freigabe. Leer = Entwurf, aenderbar. Gesetzt = Rechnungen und Ankuendigungen sind raus, der Lauf ist gesperrt.';
comment on column public.sepa_collection_runs.released_by is
  'PROJ-47: wer freigegeben hat.';

-- Bestehende Laeufe gelten als freigegeben -- das ist keine Annahme, sondern
-- ihr Zustand: ihre Rechnungen existieren und ihre Ankuendigungen sind raus.
-- Ohne diese Ruecksetzung wuerden sie als aenderbare Entwuerfe erscheinen,
-- obwohl das Geld laengst bewegt ist.
update public.sepa_collection_runs
set released_at = created_at, released_by = created_by
where released_at is null;

create index if not exists idx_sepa_runs_entwuerfe on public.sepa_collection_runs (due_date)
  where released_at is null;
