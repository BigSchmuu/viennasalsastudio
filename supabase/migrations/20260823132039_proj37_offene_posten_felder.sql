-- PROJ-37: An open item is a bounced invoice, not a separate record. These
-- three columns live on the invoice itself so the two can never drift apart.
alter table public.invoices
  add column if not exists bounce_fee numeric not null default 0,
  add column if not exists settled_at timestamptz,
  add column if not exists reminded_at timestamptz;

comment on column public.invoices.bounce_fee is
  'PROJ-37: bank fee charged for this bounced direct debit. Kept separate from '
  'gross_amount — raising the invoice itself would be wrong bookkeeping, and the '
  'reminder e-mail has to show the customer why more is owed than the invoice says.';
comment on column public.invoices.settled_at is
  'PROJ-37: set when the admin marks the open item as handled (e.g. paid in cash). '
  'Nullable and reversible: an irreversible tick on a money claim is too risky.';
comment on column public.invoices.reminded_at is
  'PROJ-37: when the last payment reminder was sent. No history is kept.';

-- Default fee, copied onto an item when it is first shown. Not a live link:
-- changing it later must not rewrite amounts already quoted to a customer.
alter table public.invoice_settings
  add column if not exists bounce_fee_default numeric not null default 0;

-- The open-items list filters exactly on these two columns.
create index if not exists idx_invoices_open_items
  on public.invoices (bounced_at) where bounced_at is not null and settled_at is null;
