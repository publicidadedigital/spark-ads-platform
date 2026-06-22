-- Admin-entered reach metrics from the Instagram Insights screenshot
-- submitted as proof_url (views/likes/comments are not available via
-- anonymous scraping, so they're recorded manually during review).
alter table public.campaign_shares
  add column if not exists views_count integer,
  add column if not exists likes_count integer,
  add column if not exists comments_count integer;
