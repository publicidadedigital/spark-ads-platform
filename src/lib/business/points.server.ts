import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePointsFromAmount } from "@/lib/business/rules";

const MAX_UPLINE_DEPTH = 50;

export type AwardPackagePointsInput = {
  userId: string;
  bonusableAmount: number;
  sourceEvent: "compra_pacote" | "renovacao_pacote";
  metadata?: Record<string, unknown>;
};

/**
 * Registra os pontos da compra/renovacao de pacote para o usuario e propaga
 * o mesmo valor de pontos para toda a linha ascendente de indicacao (infinito).
 */
export async function awardPackagePoints(admin: SupabaseClient, input: AwardPackagePointsInput) {
  const points = calculatePointsFromAmount(input.bonusableAmount);
  if (points <= 0) return;

  const rows: Record<string, unknown>[] = [
    {
      user_id: input.userId,
      source_user_id: null,
      source_event: input.sourceEvent,
      financial_amount: input.bonusableAmount,
      amount_counted_for_points: input.bonusableAmount,
      points,
      status: "valid",
      metadata: input.metadata ?? {},
    },
  ];

  let currentId: string | null = input.userId;
  for (let depth = 0; depth < MAX_UPLINE_DEPTH; depth++) {
    const { data: profile } = await admin
      .from("users_profile")
      .select("indicador_id")
      .eq("id", currentId)
      .maybeSingle();

    const indicadorId = profile?.indicador_id ?? null;
    if (!indicadorId) break;

    rows.push({
      user_id: indicadorId,
      source_user_id: input.userId,
      source_event: `${input.sourceEvent}_rede`,
      financial_amount: input.bonusableAmount,
      amount_counted_for_points: input.bonusableAmount,
      points,
      status: "valid",
      metadata: input.metadata ?? {},
    });

    currentId = indicadorId;
  }

  await admin.from("point_events").insert(rows);
}
