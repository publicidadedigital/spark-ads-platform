import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createWorker } from "https://esm.sh/tesseract.js@5.1.1";

// Reads the Instagram Insights screenshot (proof_url) and extracts
// views/likes/comments via OCR. Purely informational for the advertiser —
// bonus approval is decided separately by the 23h link-presence check in
// validate-share-links, so an imprecise OCR read here has no payout impact.
const KEYWORDS = {
  views: ["visualiza", "views", "alcance", "reach", "plays"],
  likes: ["curtida", "like", "gostei"],
  comments: ["comentario", "comentário", "comment"],
};

function parseCount(tok: string): number | null {
  const t = tok.trim().replace(/\s/g, "");
  const m = t.match(/^([\d.,]+)\s*([kKmM])?$/);
  if (!m) return null;
  let normalized = m[1];
  if (/,\d{1,2}$/.test(normalized) && !/\.\d{3}/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/[.,]/g, "");
  }
  let num = parseFloat(normalized);
  if (isNaN(num)) return null;
  const suffix = m[2]?.toLowerCase();
  if (suffix === "k") num *= 1000;
  if (suffix === "m") num *= 1000000;
  return Math.round(num);
}

function extractMetric(text: string, keywords: string[]): number | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(kw, from);
      if (idx === -1) break;
      from = idx + kw.length;
      const windowText = text.slice(Math.max(0, idx - 30), idx + kw.length + 30);
      const matches = windowText.match(/[\d][\d.,]*\s?[kKmM]?/g) ?? [];
      for (const tok of matches) {
        const n = parseCount(tok);
        if (n !== null) return n;
      }
    }
  }
  return null;
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: shares, error: fetchErr } = await supabase
    .from("campaign_shares")
    .select("id, proof_url")
    .not("proof_url", "is", null)
    .is("metrics_extracted_at", null)
    .limit(20);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!shares || shares.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const worker = await createWorker("por+eng");
  const results: unknown[] = [];

  try {
    for (const share of shares) {
      const extractedAt = new Date().toISOString();
      try {
        const { data: file, error: dlErr } = await supabase.storage.from("share-proofs").download(share.proof_url);
        if (dlErr || !file) throw dlErr ?? new Error("download failed");
        const buffer = new Uint8Array(await file.arrayBuffer());
        const { data: ocr } = await worker.recognize(buffer);
        const text = ocr.text ?? "";

        const views = extractMetric(text, KEYWORDS.views);
        const likes = extractMetric(text, KEYWORDS.likes);
        const comments = extractMetric(text, KEYWORDS.comments);

        const { error: updateErr } = await supabase
          .from("campaign_shares")
          .update({
            views_count: views,
            likes_count: likes,
            comments_count: comments,
            metrics_extracted_at: extractedAt,
            metrics_extraction_detail: text.slice(0, 500),
          })
          .eq("id", share.id);

        results.push({ id: share.id, views, likes, comments, error: updateErr?.message ?? null });
      } catch (e: unknown) {
        await supabase
          .from("campaign_shares")
          .update({ metrics_extracted_at: extractedAt, metrics_extraction_detail: `OCR failed: ${(e as Error).message ?? e}` })
          .eq("id", share.id);
        results.push({ id: share.id, error: (e as Error).message ?? String(e) });
      }
    }
  } finally {
    await worker.terminate();
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
