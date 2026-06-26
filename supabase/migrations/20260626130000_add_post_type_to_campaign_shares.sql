-- Lets the associate record whether they posted to the Instagram Feed or
-- Stories when submitting the share link. Purely informational for
-- admins/reporting today; the automated 23h link-validation routine
-- (validate-share-links / auto_approve_validated_shares) does not yet
-- branch on this value.
alter table public.campaign_shares
  add column if not exists post_type text;

alter table public.campaign_shares
  drop constraint if exists campaign_shares_post_type_check;

alter table public.campaign_shares
  add constraint campaign_shares_post_type_check
  check (post_type is null or post_type in ('feed', 'stories'));
