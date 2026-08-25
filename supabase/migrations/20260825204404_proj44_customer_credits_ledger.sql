-- PROJ-44: Das Guthaben eines Kunden als Verlauf, nicht als gespeicherte Zahl.
--
-- Ein Kontostand von 45 Euro beantwortet nicht, warum. Seit Guthaben aus zwei
-- Quellen stammen kann -- einer Empfehlung oder von Hand -- muss der Betreiber
-- Monate spaeter nachvollziehen koennen, woher es kam. Ein Verlauf beantwortet
-- das von selbst; eine zusaetzlich gepflegte Zahl koennte davon abweichen, und
-- dann wuesste niemand, welche stimmt.
create table if not exists public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,

  -- Positiv = gutgeschrieben, negativ = verrechnet oder abgezogen.
  amount numeric not null check (amount <> 0),

  -- Woher die Zeile stammt:
  --   referral  aus einer Empfehlung (Schritt 2)
  --   manual    vom Betreiber vergeben oder abgezogen
  --   redeemed  mit einer Abbuchung verrechnet
  origin text not null check (origin in ('referral', 'manual', 'redeemed')),

  -- Der Grund. Bei einer Gutschrift von Hand verpflichtend: ohne ihn waere die
  -- Zeile in drei Monaten nicht mehr erklaerbar.
  reason text,

  -- Bei origin='redeemed': mit welcher Abbuchung verrechnet wurde. Der
  -- eindeutige Index darunter sorgt dafuer, dass ein wiederholter SEPA-Lauf
  -- dasselbe Guthaben nicht zweimal verbraucht.
  collection_item_id uuid references public.sepa_collection_items(id) on delete set null,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint customer_credits_manual_needs_reason
    check (origin <> 'manual' or coalesce(trim(reason), '') <> ''),
  constraint customer_credits_redeemed_needs_item
    check (origin <> 'redeemed' or collection_item_id is not null),
  constraint customer_credits_redeemed_is_negative
    check (origin <> 'redeemed' or amount < 0)
);

-- Eine Abbuchung verbraucht Guthaben genau einmal.
create unique index if not exists idx_customer_credits_one_per_item
  on public.customer_credits (collection_item_id)
  where origin = 'redeemed';

create index if not exists idx_customer_credits_customer
  on public.customer_credits (customer_id, created_at desc);

comment on table public.customer_credits is
  'PROJ-44: Guthaben-Verlauf. Der Kontostand ist die Summe, keine eigene Spalte.';

alter table public.customer_credits enable row level security;

create policy "Credits: customer reads own"
  on public.customer_credits for select
  using (customer_id = (select auth.uid()));

create policy "Credits: admin reads all"
  on public.customer_credits for select
  using ((select public.current_role()) = 'admin');

-- Geschrieben wird ausschliesslich ueber die Funktionen weiter unten, damit die
-- Regel "niemals negatives Guthaben" nicht umgangen werden kann.
create policy "Credits: admin writes"
  on public.customer_credits for insert
  with check ((select public.current_role()) = 'admin');
