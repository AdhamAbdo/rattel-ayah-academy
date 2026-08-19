-- =====================================================================
-- Rattel Ayah Academy — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Table: admins
-- Whitelist of user ids (from Supabase Auth) allowed to write content.
-- A row is inserted here manually after you create your admin user
-- (see README "Create the first admin account").
-- ---------------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Helper used inside RLS policies to check "is the current user an admin".
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admins where user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Table: teachers
-- ---------------------------------------------------------------------
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  bio text,
  image_url text,
  specialization text,
  social_links jsonb not null default '{}'::jsonb,   -- {"whatsapp":"...","facebook":"..."}
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: courses
-- ---------------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  arabic_title text,
  description text,
  image_url text,
  category text,               -- e.g. "Quran", "Arabic", "Islamic Studies"
  level text,                  -- "Beginner" | "All Levels" | "Advanced"
  class_type text,             -- "1-on-1" | "Group"
  instructor_id uuid references teachers(id) on delete set null,
  price numeric(10,2),
  old_price numeric(10,2),
  duration text,               -- free-text, e.g. "3–6 months"
  frequency text,               -- e.g. "3x/week"
  is_featured boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: faqs
-- ---------------------------------------------------------------------
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: statistics  (the "stats band": 1000+ Students, 50+ Teachers, ...)
-- ---------------------------------------------------------------------
create table if not exists statistics (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: testimonials
-- ---------------------------------------------------------------------
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  quote text not null,
  rating integer check (rating between 1 and 5) default 5,
  image_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: social_links
-- ---------------------------------------------------------------------
create table if not exists social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,   -- 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'whatsapp'
  url text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Table: site_content
-- Generic key/value store for editable homepage text (hero, about,
-- contact info, footer, section headings, etc). Keeping this as a
-- single flexible table avoids over-engineering many tiny tables.
-- ---------------------------------------------------------------------
create table if not exists site_content (
  key text primary key,        -- e.g. 'hero', 'about', 'contact', 'footer', 'why_section'
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at auto-touch trigger (applies to all content tables)
-- ---------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['teachers','courses','faqs','statistics','testimonials','social_links','site_content']
  loop
    execute format('drop trigger if exists trg_touch_updated_at on %I;', t);
    execute format('create trigger trg_touch_updated_at before update on %I for each row execute function touch_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- Row Level Security
-- Public (anon key): read-only, and only rows that are active.
-- Admins (authenticated + present in `admins`): full read/write.
-- =====================================================================

alter table teachers      enable row level security;
alter table courses       enable row level security;
alter table faqs          enable row level security;
alter table statistics    enable row level security;
alter table testimonials  enable row level security;
alter table social_links  enable row level security;
alter table site_content  enable row level security;
alter table admins        enable row level security;

-- Public read of active rows
create policy "public read active teachers" on teachers
  for select using (is_active = true or is_admin());
create policy "public read active courses" on courses
  for select using (is_active = true or is_admin());
create policy "public read active faqs" on faqs
  for select using (is_active = true or is_admin());
create policy "public read active statistics" on statistics
  for select using (is_active = true or is_admin());
create policy "public read active testimonials" on testimonials
  for select using (is_active = true or is_admin());
create policy "public read active social_links" on social_links
  for select using (is_active = true or is_admin());
create policy "public read site_content" on site_content
  for select using (true);

-- Admin-only writes
create policy "admin write teachers" on teachers
  for all using (is_admin()) with check (is_admin());
create policy "admin write courses" on courses
  for all using (is_admin()) with check (is_admin());
create policy "admin write faqs" on faqs
  for all using (is_admin()) with check (is_admin());
create policy "admin write statistics" on statistics
  for all using (is_admin()) with check (is_admin());
create policy "admin write testimonials" on testimonials
  for all using (is_admin()) with check (is_admin());
create policy "admin write social_links" on social_links
  for all using (is_admin()) with check (is_admin());
create policy "admin write site_content" on site_content
  for all using (is_admin()) with check (is_admin());

-- admins table: nobody can read/write it via the client. It's only
-- ever touched by you, manually, from the Supabase SQL editor/dashboard,
-- and read internally by is_admin() which runs as SECURITY DEFINER.
create policy "no client access to admins" on admins
  for all using (false) with check (false);

-- =====================================================================
-- Seed data — mirrors the current static homepage content, so the
-- site looks the same the moment you connect Supabase. Edit freely
-- afterwards from the admin dashboard.
-- =====================================================================

insert into site_content (key, value) values
('hero', '{
  "badge": "Al-Azhar Certified Teachers",
  "titleBefore": "Nurturing Hearts, Building a",
  "titleHighlight": "Strong Foundation",
  "titleAfter": "in Qur''an & Arabic",
  "description": "Learn Qur''an recitation, Tajweed, Arabic language, and Islamic studies with certified native Arabic teachers from Al-Azhar University — from anywhere in the world.",
  "primaryButtonText": "Start Learning Today",
  "primaryButtonLink": "#courses",
  "secondaryButtonText": "Contact Us on WhatsApp",
  "heroImage": "/assets/images/site/hero.jpg",
  "floatCard1Title": "Free Trial", "floatCard1Sub": "Class Included",
  "floatCard2Title": "4.9 / 5 Rating", "floatCard2Sub": "1000+ Parents",
  "floatCard3Title": "Flexible", "floatCard3Sub": "Schedule Anytime"
}'::jsonb)
on conflict (key) do nothing;

insert into site_content (key, value) values
('contact', '{
  "phone": "+20 10 9392 5820",
  "whatsapp": "201093925820",
  "email": "info@rattelayah.com"
}'::jsonb)
on conflict (key) do nothing;

insert into site_content (key, value) values
('footer', '{
  "tagline": "Cultivating young hearts into confident Muslims through quality online Qur''an, Arabic, and Islamic education — with certified native Arabic teachers.",
  "logo": "/assets/images/site/logo.png"
}'::jsonb)
on conflict (key) do nothing;

insert into social_links (platform, url, display_order) values
('whatsapp', 'https://wa.me/201093925820', 1),
('facebook', '#', 2),
('instagram', '#', 3)
on conflict (platform) do nothing;

insert into statistics (label, value, display_order) values
('Students', '1000+', 1),
('Teachers', '50+', 2),
('Rating', '4.9/5', 3)
on conflict do nothing;

insert into faqs (question, answer, display_order) values
('How do the online classes work?', 'Classes are held live 1-on-1 or in small groups over video call, at a time that fits your schedule.', 1),
('Do I need any prior experience?', 'No — we offer courses for complete beginners through to advanced students.', 2),
('Is there a free trial?', 'Yes, every new student gets one free trial class before enrolling.', 3)
on conflict do nothing;

insert into teachers (name, title, bio, image_url, specialization, display_order) values
('Mr. Ahmed Motawea', 'Qur''an & Tajweed Teacher', 'Al-Azhar graduate with years of experience teaching Qur''an memorization and Tajweed to students of all ages.', '/assets/images/teachers/ahmed.jpg', 'Hifz, Tajweed', 1),
('Ms. Arwa Mohammad', 'Arabic Language Teacher', 'Native Arabic speaker specializing in Arabic language instruction for non-native speakers and children.', '/assets/images/teachers/arwa.jpg', 'Arabic Language', 2),
('Ms. Jomana Alaa Mohammed Ali', 'Islamic Studies Teacher', 'Experienced instructor in Islamic Studies and Tafseer for students of all levels.', '/assets/images/teachers/jomana.jpg', 'Islamic Studies, Tafseer', 3),
('Ms. Sohaila Mohamed', 'Qur''an Teacher', 'Dedicated teacher focused on Qur''an recitation and memorization for young learners.', '/assets/images/teachers/sohaila.png', 'Qur''an Memorization', 4)
on conflict do nothing;

-- Courses (instructor linked by name lookup, since ids are generated above)
insert into courses (title, arabic_title, description, image_url, category, level, class_type, price, old_price, duration, frequency, is_featured, display_order, instructor_id)
select 'Qur''an Memorization (Hifz)', 'حفظ القرآن', 'Memorize the Holy Qur''an with proper pronunciation and understanding, under expert guidance.', '/assets/images/courses/quran-memorization.jpg', 'Quran', 'All Levels', '1-on-1', 99, 149, '2–4 years', '5x/week', true, 1, t.id
from teachers t where t.name = 'Mr. Ahmed Motawea'
on conflict do nothing;

insert into courses (title, arabic_title, description, image_url, category, level, class_type, duration, frequency, display_order)
values
('Basic Tajweed', 'التجويد الأساسي', 'Master the rules of Tajweed and perfect your Qur''an recitation with detailed phonetic training.', '/assets/images/courses/basic-tajweed.jpg', 'Quran', 'Beginner', 'Group', '3–6 mo', '3x/week', 2),
('Arabic Language', 'اللغة العربية', 'Learn to read, write, and speak Arabic from native-speaking instructors.', '/assets/images/courses/arabic-language.jpg', 'Arabic', 'Beginner', '1-on-1', '6–12 mo', '3x/week', 3),
('Tafseer Classes', 'دروس التفسير', 'Deepen your understanding of the Qur''an''s meaning and context.', '/assets/images/courses/tafseer-classes.jpg', 'Islamic Studies', 'Advanced', 'Group', '6 mo', '2x/week', 4),
('Names of Allah', 'أسماء الله الحسنى', 'Study the 99 Names of Allah and their meanings.', '/assets/images/courses/names-of-allah.jpg', 'Islamic Studies', 'All Levels', 'Group', '2 mo', '2x/week', 5),
('Islamic Studies', 'الدراسات الإسلامية', 'A well-rounded introduction to Seerah, Hadith, and Fiqh.', '/assets/images/courses/islamic-studies.jpg', 'Islamic Studies', 'All Levels', 'Group', '6–12 mo', '2x/week', 6),
('Advanced Tajweed', 'التجويد المتقدم', 'Refine advanced Tajweed rules with focused 1-on-1 coaching.', '/assets/images/courses/advanced-tajweed.jpg', 'Quran', 'Advanced', '1-on-1', '3–6 mo', '3x/week', 7)
on conflict do nothing;
