-- ============================================================================
-- 0004_resource_courses.sql — 資源可教哪些課程(P5/P6)
--
-- P6 slot 生成:availability_rules × resource_courses × course.duration
-- P5 admin 畫面 6:每資源勾選可開課程。
-- ============================================================================

create table public.resource_courses (
  resource_id uuid not null references public.resources (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, course_id)
);

create index resource_courses_course_id_idx
  on public.resource_courses (course_id);
