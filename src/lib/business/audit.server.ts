import type { SupabaseClient } from "@supabase/supabase-js";

export type SystemLogSeverity = "baixo" | "medio" | "alto" | "critico";
export type SystemLogStatus = "novo" | "em_analise" | "resolvido" | "ignorado";

export type SystemErrorLogInput = {
  userId?: string | null;
  module: string;
  errorType: string;
  description: string;
  probableReason?: string | null;
  recommendedAction?: string | null;
  severity?: SystemLogSeverity;
  status?: SystemLogStatus;
  metadata?: Record<string, unknown>;
};

export async function recordSystemErrorLog(supabase: SupabaseClient, input: SystemErrorLogInput) {
  try {
    const payload = {
      user_id: input.userId ?? null,
      module: input.module,
      error_type: input.errorType,
      description: input.description,
      probable_reason: input.probableReason ?? null,
      recommended_action: input.recommendedAction ?? null,
      severity: input.severity ?? "medio",
      status: input.status ?? "novo",
      metadata: input.metadata ?? {},
    };

    const { error } = await supabase.from("system_error_logs").insert(payload);

    if (error) {
      console.error("[system_error_logs] failed to persist", error.message, payload);
      return { ok: false, error };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("[system_error_logs] unexpected failure", error);
    return { ok: false as const, error };
  }
}

export function describeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido sem detalhes serializaveis.";
  }
}
