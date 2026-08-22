alter table public.dance_styles drop constraint dance_styles_name_key;
create unique index dance_styles_name_lower_key on public.dance_styles (lower(name));
