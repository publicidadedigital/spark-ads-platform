-- Sync the new package accounting columns (added by audit_logs_package_accounting)
-- with the current USD catalog values for the active packages.
update public.packages set
  package_value = base_value_usd,
  course_fee = course_fee_usd,
  total_paid = valor,
  bonusable_amount = base_value_usd,
  amount_counted_for_rewards = base_value_usd,
  cycle_limit_200 = base_value_usd * 2,
  daily_bonus = ganho_diario
where slug in ('start', 'plus', 'pro', 'elite') and status = 'ativo';
