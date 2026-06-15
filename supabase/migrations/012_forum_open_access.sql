-- Open forum to all signed-in users; congressional_district is an optional post tag.
-- Run after 001_initial_schema.sql (and 002_forum_realtime.sql).

alter table public.district_posts
  alter column congressional_district drop not null;

drop policy if exists "district_posts_select_same_district" on public.district_posts;
drop policy if exists "district_posts_insert_same_district" on public.district_posts;
drop policy if exists "post_comments_select" on public.post_comments;
drop policy if exists "post_comments_insert" on public.post_comments;

create policy "district_posts_select_authenticated"
  on public.district_posts for select to authenticated
  using (true);

create policy "district_posts_insert_own"
  on public.district_posts for insert to authenticated
  with check (author_id = auth.uid());

create policy "post_comments_select_authenticated"
  on public.post_comments for select to authenticated
  using (true);

create policy "post_comments_insert_own"
  on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.district_posts p where p.id = post_id
    )
  );
