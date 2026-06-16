-- Lower the auto-approval threshold for verified live publications from 24h to 23h.
CREATE OR REPLACE FUNCTION public.auto_approve_validated_shares()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  followers_count INTEGER;
BEGIN
  FOR rec IN
    SELECT
      cs.id,
      cs.user_id,
      cs.advertiser_campaign_id,
      cs.social_network,
      COALESCE(cs.detected_followers, up.seguidores_instagram, 0) AS followers,
      cs.created_at
    FROM campaign_shares cs
    LEFT JOIN users_profile up ON up.id = cs.user_id
    WHERE
      cs.status = 'pendente'
      AND cs.auto_validate_status = 'live'
      AND (cs.validation_status IS NULL OR cs.validation_status != 'suspeito')
      AND cs.created_at < now() - INTERVAL '23 hours'
  LOOP
    followers_count := COALESCE(rec.followers, 0);

    -- Aprova a publicação
    UPDATE campaign_shares
    SET
      status      = 'aprovada',
      approved_at = now(),
      reviewed_at = now(),
      reviewed_by = NULL  -- NULL indica aprovação automática
    WHERE id = rec.id;

    -- Registra evento para campanhas de anunciantes
    IF rec.advertiser_campaign_id IS NOT NULL THEN
      INSERT INTO advertiser_campaign_events (
        advertiser_campaign_id,
        campaign_share_id,
        user_id,
        social_network,
        followers_snapshot,
        estimated_views
      ) VALUES (
        rec.advertiser_campaign_id,
        rec.id,
        rec.user_id,
        COALESCE(rec.social_network, 'instagram'),
        followers_count,
        GREATEST(followers_count, 100)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$function$;
