-- ============================================================
--  WYRM — схема базы данных для Supabase
--  Выполни этот файл в Supabase → SQL Editor → New query → Run.
--  После этого добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
--  в .env — и платформа переключится с localStorage на реальную БД.
-- ============================================================

-- профили (1:1 с auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique,
  name text,
  created_at timestamptz default now()
);

-- посты ленты
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users on delete set null,
  author_handle text not null,
  kind text not null default 'post',         -- branch | vote | discuss | post
  text text not null,
  tags text[] default '{}',
  ref jsonb,                                  -- { story, storyTitle, node }
  community_id text,
  repost_of uuid references posts on delete set null,
  created_at timestamptz default now()
);
create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists posts_community_idx on posts (community_id);

-- лайки / закладки (kind: 'like' | 'save')
create table if not exists likes (
  post_id uuid references posts on delete cascade,
  user_id uuid references auth.users on delete cascade,
  kind text not null default 'like',
  created_at timestamptz default now(),
  primary key (post_id, user_id, kind)
);

-- комментарии
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade,
  author_id uuid references auth.users on delete set null,
  author_handle text not null,
  text text not null,
  created_at timestamptz default now()
);

-- сообщества
create table if not exists communities (
  id text primary key,
  name text not null,
  blurb text,
  tags text[] default '{}',
  hue int default 28,
  owner text,
  owner_id uuid references auth.users on delete set null,
  stories text[] default '{}',
  created_at timestamptz default now()
);

-- членство
create table if not exists memberships (
  community_id text references communities on delete cascade,
  user_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (community_id, user_id)
);

-- денормализованные счётчики на постах (для ленты без тяжёлых join)
alter table posts add column if not exists like_count int default 0;
alter table posts add column if not exists save_count int default 0;
alter table posts add column if not exists comment_count int default 0;
alter table posts add column if not exists repost_count int default 0;

-- триггеры счётчиков
create or replace function bump_counts() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'likes' then
    update posts set like_count = (select count(*) from likes where post_id = coalesce(new.post_id, old.post_id) and kind='like'),
                     save_count = (select count(*) from likes where post_id = coalesce(new.post_id, old.post_id) and kind='save')
      where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'comments' then
    update posts set comment_count = (select count(*) from comments where post_id = coalesce(new.post_id, old.post_id))
      where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;
drop trigger if exists likes_count on likes;
create trigger likes_count after insert or delete on likes for each row execute function bump_counts();
drop trigger if exists comments_count on comments;
create trigger comments_count after insert or delete on comments for each row execute function bump_counts();

-- ============================================================
--  RLS: всё читается всеми; писать/менять — только своё
-- ============================================================
alter table profiles    enable row level security;
alter table posts       enable row level security;
alter table likes       enable row level security;
alter table comments    enable row level security;
alter table communities enable row level security;
alter table memberships enable row level security;

create policy "read all"      on profiles    for select using (true);
create policy "self profile"  on profiles    for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "read posts"    on posts       for select using (true);
create policy "write posts"   on posts       for insert with check (auth.uid() = author_id);
create policy "edit own post" on posts       for update using (auth.uid() = author_id);
create policy "del own post"  on posts       for delete using (auth.uid() = author_id);

create policy "read likes"    on likes       for select using (true);
create policy "own likes"     on likes       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read comments" on comments    for select using (true);
create policy "write comment" on comments    for insert with check (auth.uid() = author_id);
create policy "del own comm"  on comments    for delete using (auth.uid() = author_id);

create policy "read comm"     on communities for select using (true);
create policy "write comm"    on communities for insert with check (auth.uid() = owner_id);

create policy "read members"  on memberships for select using (true);
create policy "own members"   on memberships for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
