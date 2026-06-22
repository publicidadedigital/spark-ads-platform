-- Tracks whether the OCR job (extract-share-metrics) has already
-- processed a share's Insights screenshot, so the cron poller doesn't
-- re-read the same image every run.
alter table public.campaign_shares
  add column if not exists metrics_extracted_at timestamptz,
  add column if not exists metrics_extraction_detail text;
