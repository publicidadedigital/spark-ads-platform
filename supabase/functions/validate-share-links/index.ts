import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STORY_RE = /instagram\.com\/(stories|s)\//i;
const FEED_RE  = /instagram\.com\/(p|reel|tv)\//i;

function isStoryLink(url: string): boolean { return STORY_RE.test(url); }
function isFeedLink(url: string): boolean  { return FEED_RE.test(url); }

async function checkLink(url: string): Promise<{ status: string; detail: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(tid);
    const detail = `HTTP ${res.status}`;
    if (res.status === 200) return { status: "live", detail };
    if (res.status === 404 || res.status === 410) return { status: "removed", detail };
    if (res.status >= 400 && res.status < 500) return { status: "private", detail };
    return { status: "check_failed", detail };
  } catch (e: unknown) {
    return { status: "check_failed", detail: (e as Error).message ?? "fetch error" };
  }
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Shares due for auto-validation (auto_validate_at <= now, still pending)
  const { data: shares, error: fetchErr } = await supabase
    .from("campaign_shares")
    .select("id, shared_link, user_id, advertiser_campaign_id, detected_followers")
    .eq("auto_validate_status", "pending")
    .not("auto_validate_at", "is", null)
    .lte("auto_validate_at", new Date().toISOString())
    .limit(100);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  const results: unknown[] = [];

  for (const share of shares ?? []) {
    const url: string = share.shared_link ?? "";
    let validateStatus: string;
    let detail: string;

    if (!url) {
      validateStatus = "check_failed";
      detail = "Sem URL";
    } else if (isStoryLink(url)) {
      // Stories expire naturally in 24h — require manual proof review
      validateStatus = "story_manual";
      detail = "Story: validação manual pelo print obrigatória";
    } else if (isFeedLink(url)) {
      const r = await checkLink(url);
      validateStatus = r.status;
      detail = r.detail;
    } else {
      // Other platforms (Twitter/X, TikTok etc.) — attempt HTTP check
      const r = await checkLink(url);
      validateStatus = r.status;
      detail = r.detail;
    }

    const checkedAt = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      auto_validate_status: validateStatus,
      auto_validate_checked_at: checkedAt,
      auto_validate_detail: detail,
    };

    // Auto-approve if post is confirmed live
    if (validateStatus === "live") {
      updateData.status = "aprovada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = null;
    }

    // Auto-reject if post was removed before 24h
    if (validateStatus === "removed") {
      updateData.status = "rejeitada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = "Post removido antes de completar 24h";
    }

    const { error: updateErr } = await supabase
      .from("campaign_shares")
      .update(updateData)
      .eq("id", share.id);

    // Create advertiser_campaign_events when auto-approved for advertiser campaigns
    if (validateStatus === "live" && share.advertiser_campaign_id && !updateErr) {
      const followers = Number(share.detected_followers ?? 0);
      await supabase.from("advertiser_campaign_events").insert({
        advertiser_campaign_id: share.advertiser_campaign_id,
        campaign_share_id: share.id,
        user_id: share.user_id,
        social_network: "instagram",
        followers_snapshot: followers,
        estimated_views: Math.max(followers, 100),
      });
    }

    results.push({ id: share.id, url, validateStatus, detail, error: updateErr?.message ?? null });
  }

  return new Response(
    JSON.stringify({ processed: results.length, ts: new Date().toISOString(), results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
