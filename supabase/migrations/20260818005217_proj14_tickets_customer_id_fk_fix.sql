-- tickets.customer_id must reference profiles (not auth.users directly) so
-- PostgREST can embed profiles(full_name) in guest-list/search queries,
-- matching every other customer_id column in the project.
alter table public.tickets drop constraint tickets_customer_id_fkey;
alter table public.tickets add constraint tickets_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;
