
-- Video sets (internal teacher/admin material)
create table video_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text,
  created_at timestamptz not null default now(),
  constraint video_sets_level_check check (level is null or level in ('beginner','improver','intermediate','advanced','open_level'))
);
create unique index video_sets_name_lower_key on video_sets (lower(name));

create table video_set_lessons (
  id uuid primary key default gen_random_uuid(),
  video_set_id uuid not null references video_sets(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_video_set_lessons_video_set_id on video_set_lessons(video_set_id);

create table video_set_lesson_videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references video_set_lessons(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index idx_video_set_lesson_videos_lesson_id on video_set_lesson_videos(lesson_id);

-- Courses: replace single video-link concept with a video-set reference
alter table courses add column video_set_id uuid references video_sets(id) on delete restrict;
create index idx_courses_video_set_id on courses(video_set_id);

-- Drop the old single-link table from PROJ-3 (no production data to migrate)
drop table if exists course_materials;

-- RLS
alter table video_sets enable row level security;
alter table video_set_lessons enable row level security;
alter table video_set_lesson_videos enable row level security;

create policy "VideoSets: admin insert" on video_sets for insert with check ("current_role"() = 'admin');
create policy "VideoSets: admin update" on video_sets for update using ("current_role"() = 'admin');
create policy "VideoSets: admin delete" on video_sets for delete using ("current_role"() = 'admin');
create policy "VideoSets: admin or assigned teacher read" on video_sets for select using (
  "current_role"() = 'admin'
  or exists (
    select 1 from courses c
    join course_teachers ct on ct.course_id = c.id
    where c.video_set_id = video_sets.id and ct.teacher_id = (select auth.uid())
  )
);

create policy "VideoSetLessons: admin insert" on video_set_lessons for insert with check ("current_role"() = 'admin');
create policy "VideoSetLessons: admin update" on video_set_lessons for update using ("current_role"() = 'admin');
create policy "VideoSetLessons: admin delete" on video_set_lessons for delete using ("current_role"() = 'admin');
create policy "VideoSetLessons: admin or assigned teacher read" on video_set_lessons for select using (
  "current_role"() = 'admin'
  or exists (
    select 1 from courses c
    join course_teachers ct on ct.course_id = c.id
    where c.video_set_id = video_set_lessons.video_set_id and ct.teacher_id = (select auth.uid())
  )
);

create policy "VideoSetLessonVideos: admin insert" on video_set_lesson_videos for insert with check ("current_role"() = 'admin');
create policy "VideoSetLessonVideos: admin update" on video_set_lesson_videos for update using ("current_role"() = 'admin');
create policy "VideoSetLessonVideos: admin delete" on video_set_lesson_videos for delete using ("current_role"() = 'admin');
create policy "VideoSetLessonVideos: admin or assigned teacher read" on video_set_lesson_videos for select using (
  "current_role"() = 'admin'
  or exists (
    select 1 from video_set_lessons l
    join courses c on c.video_set_id = l.video_set_id
    join course_teachers ct on ct.course_id = c.id
    where l.id = video_set_lesson_videos.lesson_id and ct.teacher_id = (select auth.uid())
  )
);
