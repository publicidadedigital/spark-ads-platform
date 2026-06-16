-- Auto-finalize advertiser campaigns once they've run for the duration_days of their package.
-- Runs hourly via pg_cron. Targets campaigns currently active (status ativa/em_distribuicao)
-- whose approved_at + package.duration_days has elapsed.
CREATE OR REPLACE FUNCTION public.auto_finalize_advertiser_campaigns()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE advertiser_campaigns ac
  SET status = 'finalizada'
  FROM advertiser_campaign_orders aco
  JOIN advertising_packages ap ON ap.id = aco.advertising_package_id
  WHERE ac.order_id = aco.id
    AND ac.status IN ('ativa', 'em_distribuicao')
    AND ac.approved_at IS NOT NULL
    AND ap.duration_days IS NOT NULL
    AND ac.approved_at + (ap.duration_days || ' days')::interval <= now();
END;
$function$;

SELECT cron.schedule(
  'auto-finalize-advertiser-campaigns',
  '0 * * * *',
  $$SELECT auto_finalize_advertiser_campaigns();$$
);
