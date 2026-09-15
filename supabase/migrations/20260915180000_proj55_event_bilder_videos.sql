-- PROJ-55: Bilder und Videos für Events und Serien.
--
-- Die erste Stelle der App, an der jemand eine Datei hochlädt. Bisher entsteht
-- jede Datei in der App selbst — SEPA-Datei, Rechnungen, QR-Codes. Deshalb
-- kommt hier zweierlei dazu: zwei Tabellen für die Angaben und ein Bereich im
-- Bildspeicher für die Dateien, beide mit denselben Rechten.
--
-- Reihenfolge beim Ausliefern: erst diese Migration, dann der Code. Der neue
-- Code liest die Bilder auf jedem Aufruf von /events mit.

-- ---------------------------------------------------------------------------
-- Bilder
-- ---------------------------------------------------------------------------

create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  -- Ein Bild gehört zu einem Event oder zu einer Serie, nie zu beidem und nie
  -- zu keinem. Ein Serientermin hat keine eigenen: Er zeigt die seiner Serie.
  event_id uuid references public.events(id) on delete cascade,
  series_id uuid references public.event_series(id) on delete cascade,
  role text not null default 'gallery' check (role in ('cover', 'gallery')),
  storage_path text not null unique,
  alt_text text check (alt_text is null or length(alt_text) <= 300),
  -- Die Maße stehen hier, damit die Seite den Platz kennt, bevor das Bild da
  -- ist. Ohne sie springt der Text beim Laden.
  width int not null check (width > 0),
  height int not null check (height > 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint event_images_genau_ein_ziel check (
    (event_id is not null and series_id is null) or (event_id is null and series_id is not null)
  )
);

create index idx_event_images_event_id on public.event_images(event_id);
create index idx_event_images_series_id on public.event_images(series_id);

-- Höchstens ein Titelbild je Event und je Serie. Die Verwaltung tauscht es
-- aus; ohne diese Sperre stünden nach zwei gleichzeitigen Versuchen zwei da,
-- und die Karte zeigte das zufällig erste.
create unique index event_images_ein_titelbild_je_event
  on public.event_images(event_id)
  where role = 'cover' and event_id is not null;

create unique index event_images_ein_titelbild_je_serie
  on public.event_images(series_id)
  where role = 'cover' and series_id is not null;

alter table public.event_images enable row level security;

-- Öffentlich lesbar: Es sind die Bilder öffentlicher Seiten.
create policy "EventImages: public read" on public.event_images
  for select using (true);

create policy "EventImages: admin insert" on public.event_images
  for insert with check (public.current_role() = 'admin');

create policy "EventImages: admin update" on public.event_images
  for update using (public.current_role() = 'admin');

create policy "EventImages: admin delete" on public.event_images
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------

create table public.event_videos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  series_id uuid references public.event_series(id) on delete cascade,
  -- Gespeichert wird die Kennung, nicht der Link: Aus ihr baut die App die
  -- Einbettung ohne Cookies. Ein ganzer Link brächte Parameter mit, die dabei
  -- nur stören.
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{5,32}$'),
  title text check (title is null or length(title) <= 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint event_videos_genau_ein_ziel check (
    (event_id is not null and series_id is null) or (event_id is null and series_id is not null)
  )
);

create index idx_event_videos_event_id on public.event_videos(event_id);
create index idx_event_videos_series_id on public.event_videos(series_id);

alter table public.event_videos enable row level security;

create policy "EventVideos: public read" on public.event_videos
  for select using (true);

create policy "EventVideos: admin insert" on public.event_videos
  for insert with check (public.current_role() = 'admin');

create policy "EventVideos: admin update" on public.event_videos
  for update using (public.current_role() = 'admin');

create policy "EventVideos: admin delete" on public.event_videos
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Der Bildspeicher
-- ---------------------------------------------------------------------------
-- Die verlässliche Schranke für Format und Größe sitzt hier, nicht im Browser:
-- Eine Prüfung, die nur dort steht, lässt sich umgehen. Der Bereich nimmt
-- nichts an, was kein Bild ist, und nichts über 10 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-bilder',
  'event-bilder',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lesen darf jeder — der Bereich ist öffentlich, und die Verwaltung braucht
-- das Auflisten, um eine hochgeladene Datei nachzuschlagen.
create policy "EventBilder: public read"
  on storage.objects
  for select
  using (bucket_id = 'event-bilder');

create policy "EventBilder: admin insert"
  on storage.objects
  for insert
  with check (bucket_id = 'event-bilder' and public.current_role() = 'admin');

create policy "EventBilder: admin update"
  on storage.objects
  for update
  using (bucket_id = 'event-bilder' and public.current_role() = 'admin');

create policy "EventBilder: admin delete"
  on storage.objects
  for delete
  using (bucket_id = 'event-bilder' and public.current_role() = 'admin');
