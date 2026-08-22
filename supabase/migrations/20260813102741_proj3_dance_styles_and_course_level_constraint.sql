-- PROJ-3: dance_styles table (admin-managed) + fixed level values on courses

create table public.dance_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.dance_styles enable row level security;

create policy "DanceStyles: public read" on public.dance_styles
  for select using (true);

create policy "DanceStyles: admin insert" on public.dance_styles
  for insert with check (public.current_role() = 'admin');

create policy "DanceStyles: admin update" on public.dance_styles
  for update using (public.current_role() = 'admin');

create policy "DanceStyles: admin delete" on public.dance_styles
  for delete using (public.current_role() = 'admin');

-- Replace the free-text dance_style column with a reference to dance_styles
alter table public.courses add column dance_style_id uuid references public.dance_styles(id) on delete restrict;
alter table public.courses drop column dance_style;

create index idx_courses_dance_style_id on public.courses(dance_style_id);

-- Constrain level to the fixed set used by the marketing site / design system
alter table public.courses add constraint courses_level_check
  check (level is null or level in ('beginner', 'improver', 'intermediate', 'advanced', 'open_level'));
