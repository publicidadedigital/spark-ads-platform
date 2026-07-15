import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STORY_RE = /instagram\.com\/(stories|s)\//i;

function isStoryLink(url: string): boolean { return STORY_RE.test(url); }

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
    if (res.status === 429 || res.status === 503 || res.status === 502) return { status: "check_failed", detail };
    if (res.status === 403 || res.status === 401) return { status: "private", detail };
    if (res.status >= 400 && res.status < 500) return { status: "check_failed", detail };
    return { status: "check_failed", detail };
  } catch (e: unknown) {
    return { status: "check_failed", detail: (e as Error).message ?? "fetch error" };
  }
}

async function processShare(
  supabase: ReturnType<typeof createClient>,
  share: { id: string; shared_link: string | null; user_id: string; advertiser_campaign_id: string | null; detected_followers: number | null },
  initialCheck: boolean,
): Promise<unknown> {
  const url: string = share.shared_link ?? "";
  let validateStatus: string;
  let detail: string;

  if (!url) {
    validateStatus = "check_failed";
    detail = "Sem URL";
  } else {
    const r = await checkLink(url);
    validateStatus = r.status;
    detail = r.detail + (isStoryLink(url) ? " (story)" : "");
  }

  const checkedAt = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    auto_validate_checked_at: checkedAt,
    auto_validate_detail: detail,
  };

  if (initialCheck) {
    // First check (at submission time): only reject if link is provably dead.
    // "live" → keep pending, 23h countdown already set by DB trigger.
    // "removed" / "private" → reject immediately.
    // "check_failed" → leave pending (Instagram may block bots intermittently).
    if (validateStatus === "removed") {
      updateData.auto_validate_status = "removed";
      updateData.status = "rejeitada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = "Link não encontrado — verifique se o post está público e tente novamente";
    } else if (validateStatus === "private") {
      updateData.auto_validate_status = "private";
      updateData.status = "rejeitada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = "Perfil privado — as campanhas exigem perfil público no Instagram";
    } else {
      // live or check_failed: keep status=pendente, mark initial check done
      updateData.auto_validate_status = "pending";
    }
  } else {
    // 23h check: full decision
    updateData.auto_validate_status = validateStatus;

    if (validateStatus === "live") {
      updateData.status = "aprovada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = null;
    } else if (validateStatus === "removed") {
      updateData.status = "rejeitada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = "Post removido antes de completar 24h";
    } else if (validateStatus === "private") {
      updateData.status = "rejeitada";
      updateData.reviewed_at = checkedAt;
      updateData.motivo_rejeicao = "Perfil privado — as campanhas exigem perfil público no Instagram";
    }
  }

  const { error: updateErr } = await supabase
    .from("campaign_shares")
    .update(updateData)
    .eq("id", share.id);

  // Create advertiser_campaign_events when auto-approved (23h check only)
  if (!initialCheck && validateStatus === "live" && share.advertiser_campaign_id && !updateErr) {
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

  return { id: share.id, url, validateStatus, detail, initialCheck, error: updateErr?.message ?? null };
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional body: { shareId: string } for immediate single-share check at submission time
  let shareId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    shareId = body?.shareId ?? null;
  } catch { /* no body */ }

  if (shareId) {
    // Immediate check for a specific share (called right after submission)
    const { data: share, error: fetchErr } = await supabase
      .from("campaign_shares")
      .select("id, shared_link, user_id, advertiser_campaign_id, detected_followers")
      .eq("id", shareId)
      .maybeSingle();

    if (fetchErr || !share) {
      return new Response(JSON.stringify({ error: fetchErr?.message ?? "Share not found" }), { status: 400 });
    }

    const result = await processShare(supabase, share, true);
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }

  // Scheduled run: process all shares where auto_validate_at <= now
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
    const result = await processShare(supabase, share, false);
    results.push(result);
  }

  return new Response(
    JSON.stringify({ processed: results.length, ts: new Date().toISOString(), results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
