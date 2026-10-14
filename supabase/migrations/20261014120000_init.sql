-- The Cinematheque: initial schema (BRIEF.md › Data model).
-- Single user. Row-level security is ON for every table with NO policies, so the public (publishable) key
-- can read and write nothing. Only the app's server, using the secret key, reaches the data.

create extension if not exists pgcrypto;

create type title_kind as enum ('movie', 'series');
create type watch_source as enum ('plex', 'manual');
create type note_status as enum ('draft', 'checked');
create type programme_type as enum ('edition', 'festival', 'days31', 'marathon', 'curriculum', 'retrospective', 'family_tree', 'time_capsule', 'essay_series');
create type programme_status as enum ('draft', 'live', 'archived');
create type link_kind as enum ('inspired', 'influenced', 'pairs_with');
create type rec_lane as enum ('popular', 'deep_cut');
create type rec_feedback as enum ('up', 'down', 'dismissed');

create table titles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- used in URLs, e.g. the-thing-1982
  kind title_kind not null,
  tmdb_id integer,
  imdb_id text,
  title text not null,
  year integer,
  runtime integer,                           -- minutes (films)
  seasons_count integer,
  genres text[] not null default '{}',
  keywords text[] not null default '{}',
  director_or_creator text,
  cast_names text[] not null default '{}',
  country text,
  language text,
  overview text,
  poster_url text,
  backdrop_url text,
  logo_url text,
  spine_bg text,                             -- darkest common poster colour
  spine_accent text,                         -- most vivid common poster colour
  logo_dark boolean not null default false,  -- dark logo gets a light spine
  logo_ratio real,
  plex_rating_key text,
  on_plex boolean not null default false,
  rating_imdb real,
  rating_rt integer,
  rating_metacritic integer,
  metadata_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, tmdb_id)
);
create index titles_imdb_idx on titles (imdb_id);
create index titles_on_plex_idx on titles (on_plex);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  season integer not null,
  episode integer not null,
  name text,
  runtime integer,
  plex_rating_key text,
  unique (title_id, season, episode)
);

create table watches (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  episode_id uuid references episodes (id) on delete cascade,
  watched_at timestamptz not null,
  source watch_source not null,
  rating smallint check (rating between 1 and 5),
  note text
);
-- One watch per title/episode per day per source (the hourly Plex sync can run repeatedly without duplicates).
create unique index watches_once_per_day on watches (title_id, coalesce(episode_id, '00000000-0000-0000-0000-000000000000'::uuid), ((watched_at at time zone 'UTC')::date), source);

create table title_notes (
  title_id uuid primary key references titles (id) on delete cascade,
  fact_cards jsonb not null default '[]',
  liner_notes text,
  sources text[] not null default '{}',
  status note_status not null default 'draft',
  updated_at timestamptz not null default now()
);

create table programmes (
  id uuid primary key default gen_random_uuid(),
  type programme_type not null,
  title text not null,
  slug text not null unique,
  theme text,
  essay text,
  start_date date,
  end_date date,
  accent_color text,
  poster_url text,
  status programme_status not null default 'draft',
  spine_number integer unique,               -- editions only: No. 001, No. 002…
  source_note text,
  created_at timestamptz not null default now()
);

create table programme_items (
  programme_id uuid not null references programmes (id) on delete cascade,
  title_id uuid not null references titles (id) on delete cascade,
  episode_id uuid references episodes (id) on delete cascade,
  position integer not null,
  chapter text,
  slot_date date,
  programme_note text,
  done boolean not null default false,
  primary key (programme_id, position)
);

create table awards (
  programme_id uuid not null references programmes (id) on delete cascade,
  category text not null,
  title_id uuid references titles (id) on delete set null,
  note text,
  primary key (programme_id, category)
);

create table title_links (
  from_title_id uuid not null references titles (id) on delete cascade,
  to_title_id uuid not null references titles (id) on delete cascade,
  kind link_kind not null,
  note text,
  verified boolean not null default false,
  primary key (from_title_id, to_title_id, kind)
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  lane rec_lane not null,
  reason text,
  score real,
  created_at timestamptz not null default now(),
  feedback rec_feedback
);

create table wishlist (
  title_id uuid primary key references titles (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);

create table pending_checks (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  episode_id uuid references episodes (id) on delete cascade,
  opened_at timestamptz not null default now()
);

-- Lock everything to the server.
alter table titles enable row level security;
alter table episodes enable row level security;
alter table watches enable row level security;
alter table title_notes enable row level security;
alter table programmes enable row level security;
alter table programme_items enable row level security;
alter table awards enable row level security;
alter table title_links enable row level security;
alter table recommendations enable row level security;
alter table wishlist enable row level security;
alter table pending_checks enable row level security;
