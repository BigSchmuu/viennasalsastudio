-- PROJ-44: Der persoenliche Empfehlungscode und die Zuordnung "geworben von".
--
-- Der Code lebt am Kunden, nicht in der Gutschein-Tabelle: Ein Gutschein hat
-- Auflage und Ablauf, ein Empfehlungscode gehoert einer Person und gilt
-- unbefristet. Die Eingabe teilen sie sich trotzdem.

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_rewarded_at timestamptz;

-- Niemand wirbt sich selbst.
alter table public.profiles drop constraint if exists profiles_referred_by_not_self;
alter table public.profiles
  add constraint profiles_referred_by_not_self check (referred_by is null or referred_by <> id);

create unique index if not exists idx_profiles_referral_code
  on public.profiles (upper(referral_code)) where referral_code is not null;

create index if not exists idx_profiles_referred_by
  on public.profiles (referred_by) where referred_by is not null;

-- Zufaellig erzeugt, nicht aus dem Namen gebildet: Ein Code wie ANNA-M waere
-- erratbar, und wer fremde Codes durchprobiert, koennte sich Guthaben
-- verschaffen.
--
-- Das Alphabet laesst 0/O und 1/I/L weg. Ein Code wird abgetippt, oft von
-- einem Zettel oder aus einer Nachricht, und ein O statt einer 0 kostet den
-- Geworbenen seinen Rabatt.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_versuch int := 0;
begin
  loop
    v_code := 'VSS-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.profiles where upper(referral_code) = upper(v_code)
    );

    v_versuch := v_versuch + 1;
    if v_versuch > 50 then
      raise exception 'could not generate a unique referral code';
    end if;
  end loop;

  return v_code;
end;
$$;

-- Jeder Kunde bekommt seinen Code beim Anlegen. Lehrer und Betreiber nicht:
-- Lehrer als Werbende sind ausdruecklich nicht Teil dieses Features.
create or replace function public.assign_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'customer' and new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_referral_code on public.profiles;
create trigger trg_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- Die bestehenden Kunden bekommen ihren Code jetzt, nicht erst beim naechsten
-- Speichern ihres Profils.
update public.profiles
set referral_code = public.generate_referral_code()
where role = 'customer' and referral_code is null;
