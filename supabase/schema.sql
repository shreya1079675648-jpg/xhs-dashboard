-- ═══════════════════════════════════════════════════════════════════
-- 小红书运营仪表盘 · Supabase Schema
-- 在 Supabase Dashboard → SQL Editor 里全部复制粘贴运行即可
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES（扩展 auth.users，存用户元信息）─────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now()
);

-- 注册时自动创建 profile
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── 2. TOPICS（笔记主表）────────────────────────────────────────
create table if not exists topics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  pillar text,
  status text default '灵感池',
  score int default 70,
  scored_at timestamptz,
  goal text,
  tag text,
  note_type text default 'image',
  publish_time timestamptz,
  tags text[] default '{}',
  cover_text text,
  cover_image_path text,           -- Supabase Storage 路径
  ai_prediction jsonb,
  snapshots jsonb default '[]',
  auto_scheduled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists topics_user_id_idx on topics(user_id);
create index if not exists topics_status_idx on topics(status);

-- ─── 3. NOTE_IMAGES（每条笔记的图片列表）──────────────────────────
create table if not exists note_images (
  id uuid default gen_random_uuid() primary key,
  topic_id uuid references topics(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  storage_path text not null,      -- Supabase Storage 文件路径
  display_order int default 0,
  name text,
  size int,
  created_at timestamptz default now()
);

create index if not exists note_images_topic_id_idx on note_images(topic_id);
create index if not exists note_images_user_id_idx on note_images(user_id);

-- ─── 4. COMMENTS（评论话术模板）──────────────────────────────────
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  scene text,
  reply text,
  tag text,
  created_at timestamptz default now()
);

create index if not exists comments_user_id_idx on comments(user_id);

-- ─── 5. PATTERN_REPORTS（AI 规律报告，每用户一份）────────────────
create table if not exists pattern_reports (
  user_id uuid references auth.users on delete cascade primary key,
  hit_patterns jsonb,
  fail_patterns jsonb,
  strategies jsonb,
  skill_evolution jsonb,
  analyzed_at timestamptz,
  analyzed_count int,
  updated_at timestamptz default now()
);

-- ─── 6. ROW LEVEL SECURITY（行级安全：每个用户只能访问自己的数据）─
alter table profiles enable row level security;
alter table topics enable row level security;
alter table note_images enable row level security;
alter table comments enable row level security;
alter table pattern_reports enable row level security;

-- profiles
drop policy if exists "users can view own profile" on profiles;
create policy "users can view own profile" on profiles
  for select using (auth.uid() = id);
drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id);

-- topics
drop policy if exists "users can read own topics" on topics;
create policy "users can read own topics" on topics
  for select using (auth.uid() = user_id);
drop policy if exists "users can insert own topics" on topics;
create policy "users can insert own topics" on topics
  for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own topics" on topics;
create policy "users can update own topics" on topics
  for update using (auth.uid() = user_id);
drop policy if exists "users can delete own topics" on topics;
create policy "users can delete own topics" on topics
  for delete using (auth.uid() = user_id);

-- note_images
drop policy if exists "users can read own images" on note_images;
create policy "users can read own images" on note_images
  for select using (auth.uid() = user_id);
drop policy if exists "users can insert own images" on note_images;
create policy "users can insert own images" on note_images
  for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own images" on note_images;
create policy "users can update own images" on note_images
  for update using (auth.uid() = user_id);
drop policy if exists "users can delete own images" on note_images;
create policy "users can delete own images" on note_images
  for delete using (auth.uid() = user_id);

-- comments
drop policy if exists "users can read own comments" on comments;
create policy "users can read own comments" on comments
  for select using (auth.uid() = user_id);
drop policy if exists "users can insert own comments" on comments;
create policy "users can insert own comments" on comments
  for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own comments" on comments;
create policy "users can update own comments" on comments
  for update using (auth.uid() = user_id);
drop policy if exists "users can delete own comments" on comments;
create policy "users can delete own comments" on comments
  for delete using (auth.uid() = user_id);

-- pattern_reports
drop policy if exists "users can read own report" on pattern_reports;
create policy "users can read own report" on pattern_reports
  for select using (auth.uid() = user_id);
drop policy if exists "users can upsert own report" on pattern_reports;
create policy "users can upsert own report" on pattern_reports
  for insert with check (auth.uid() = user_id);
drop policy if exists "users can update own report" on pattern_reports;
create policy "users can update own report" on pattern_reports
  for update using (auth.uid() = user_id);

-- ─── 7. AUTO-UPDATE updated_at TIMESTAMP ────────────────────────
create or replace function update_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists topics_updated_at on topics;
create trigger topics_updated_at before update on topics
  for each row execute function update_updated_at();

drop trigger if exists pattern_reports_updated_at on pattern_reports;
create trigger pattern_reports_updated_at before update on pattern_reports
  for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- ✅ Schema 设置完成！
-- 下一步：在 Storage 标签创建一个名为 'note-assets' 的 bucket（私有）
-- ═══════════════════════════════════════════════════════════════════
