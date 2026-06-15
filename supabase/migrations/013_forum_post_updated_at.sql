-- Bump updated_at automatically when a forum post is edited.

create or replace function public.set_district_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists district_posts_updated_at on public.district_posts;

create trigger district_posts_updated_at
  before update on public.district_posts
  for each row
  execute function public.set_district_posts_updated_at();
