-- The Cinematheque: settings the app keeps for itself (the Plex connection, the last Plex sync).
-- Server only, like every other table: row-level security on with no policies, so the publishable key can't read it.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
grant select, insert, update, delete on app_settings to service_role;
revoke all on app_settings from anon, authenticated;
