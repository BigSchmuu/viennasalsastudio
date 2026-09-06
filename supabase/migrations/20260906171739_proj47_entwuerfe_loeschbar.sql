-- PROJ-47, gefunden in der QA: Auf beiden Tabellen gab es keine DELETE-Regel.
--
-- "Position entfernen" und "Entwurf verwerfen" liefen ueber den
-- RLS-gebundenen Client und trafen damit null Zeilen. PostgREST meldet einen
-- Loeschvorgang ohne Treffer nicht als Fehler -- die Aktion meldete Erfolg,
-- zeigte den Hinweis und aenderte nichts. Der Betreiber haette geglaubt, eine
-- Position entfernt zu haben, und den Lauf freigegeben.
--
-- Die Regeln erlauben das Loeschen ausdruecklich nur im Entwurf. Damit gilt
-- dieselbe Grenze zweimal: hier und im Waechter auf den Positionen. Ein
-- freigegebener Lauf laesst sich weiterhin durch nichts entfernen, was ueber
-- die Anwendung geht.
create policy "Sepa collection runs: admin delete draft"
  on public.sepa_collection_runs for delete
  using ("current_role"() = 'admin' and released_at is null);

create policy "Sepa collection items: admin delete draft"
  on public.sepa_collection_items for delete
  using (
    "current_role"() = 'admin'
    and exists (
      select 1 from public.sepa_collection_runs r
      where r.id = sepa_collection_items.run_id and r.released_at is null
    )
  );
