import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STORY_RE = /instagram\.com\/(stories|s)\//i;

function isStoryLink(url: string): boolean { return STORY_RE.test(url); }

function extractUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:stories|s)\/([^/?#]+)/i);
  return m ? m[1] : null;
}

async function isProfilePrivate(username: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const html = await res.text();
    if (/\"is_private\"\s*:\s*true/i.test(html)) return true;
    if (/\"isPrivate\"\s*:\s*true/i.test(html)) return true;
    if (/this account is private/i.test(html)) return true;
    if (/esta conta é privada/i.test(html)) return true;
    return false;
  } catch {
    return null;
  }
}

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
    const httpDetail = `HTTP ${res.status}`;
    if (res.status === 404 || res.status === 410) return { status: "removed", detail: httpDetail };
    if (res.status === 403 || res.status === 401) return { status: "private", detail: httpDetail };
    if (res.status === 429 || res.status === 503 || res.status === 502) return { status: "check_failed", detail: httpDetail };
    if (res.status >= 400 && res.status < 500) return { status: "check_failed", detail: httpDetail };
    if (res.status === 200) {
      const html = await res.text();
      if (/\"is_private\"\s*:\s*true/i.test(html) || /\"isPrivate\"\s*:\s*true/i.test(html) ||
          /this account is private/i.test(html) || /esta conta é privada/i.test(html)) {
        return { status: "private", detail: `${httpDetail} (private profile detected in body)` };
      }
      return { status: "live", detail: httpDetail };
    }
    return { status: "check_failed", detail: httpDetail };
  } catch (e: unknown) {
    return { status: "check_failed", detail: (e as Error).message ?? "fetch error" };
  }
}

async function processShare(
  supabase: ReturnType<typeof createClient>,
  share: { id: string; shared_link: string | null; user_id: string; advertiser_campaign_id: string | null; detected_followers: number | null; check_fail_count?: number | null },
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

    // For stories: also check the profile page directly for private accounts
    if ((validateStatus === "live" || validateStatus === "check_failed") && isStoryLink(url)) {
      const username = extractUsername(url);
      if (username) {
        const privateResult = await isProfilePrivate(username);
        if (privateResult === true) {
          validateStatus = "private";
          detail = `${detail} + perfil @${username} é privado`;
        }
      }
    }
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
    if (validateStatus === "check_failed") {
      // Instagram rate-limited or unreachable — schedule retry in 2h (up to 3 retries)
      const retryCount = Number(share.check_fail_count ?? 0) + 1;
      if (retryCount <= 3) {
        const retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        updateData.auto_validate_status = "pending";
        updateData.auto_validate_at = retryAt;
        updateData.check_fail_count = retryCount;
        updateData.auto_validate_detail = `${detail} (tentativa ${retryCount}/3, retry em 2h)`;
      } else {
        // After 3 retries, leave as check_failed for manual review
        updateData.auto_validate_status = "check_failed";
        updateData.auto_validate_detail = `${detail} (máx tentativas atingido — revisão manual necessária)`;
      }
    } else {
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
      .select("id, shared_link, user_id, advertiser_campaign_id, detected_followers, check_fail_count")
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
    .select("id, shared_link, user_id, advertiser_campaign_id, detected_followers, check_fail_count")
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
