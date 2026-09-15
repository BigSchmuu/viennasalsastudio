-- PROJ-56, Nachtrag: die alte Kauffunktion entfernen.
--
-- In der Migration davor stand, `create or replace` genüge, weil die drei
-- neuen Parameter Vorgabewerte haben. Das ist falsch: Postgres erkennt eine
-- Funktion an Name **und** Parameterliste. Mit den drei zusätzlichen
-- Parametern ist eine zweite Funktion entstanden, und die alte blieb daneben
-- stehen.
--
-- Die Folge zeigte sich sofort im Test: Ein Aufruf mit fünf Argumenten — genau
-- der, den die App macht — passte auf beide, und Postgres antwortete mit
-- „Could not choose the best candidate function". Damit war jeder Ticketkauf
-- unmöglich.
--
-- Dieselbe Falle steht schon in der Migration zu PROJ-54 beschrieben, für
-- checkin_event_ticket. Dort war sie richtig gelöst; hier nicht.

drop function if exists public.purchase_event_ticket(uuid, text, boolean, boolean, text);

-- Die Rechte der verbliebenen Fassung sind in der vorigen Migration vergeben
-- worden und bleiben davon unberührt.
