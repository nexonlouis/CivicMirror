-- Forum posts: multiple issue tags per post (replaces single issue_slug).

alter table public.district_posts
  add column issue_slugs text[] not null default '{}';

update public.district_posts
  set issue_slugs = array[issue_slug]
  where issue_slug is not null;

drop index if exists district_posts_issue_idx;

alter table public.district_posts
  drop column issue_slug;

create index district_posts_issue_slugs_gin
  on public.district_posts using gin (issue_slugs);
