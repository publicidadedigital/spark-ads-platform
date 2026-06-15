export const COURSE_FEE_USD = 10;
export const POINT_RATE_PER_USD = 0.1;
export const DAILY_SHARE_BONUS_RATE = 0.0026;
export const VME_DIRECT_LEG_LIMIT = 0.25;
export const MIN_WITHDRAWAL_USD = 50;
export const MAX_WITHDRAWAL_USD = 4000;

export const SIGNUP_RENEWAL_BONUS_MATRIX = [0.2, 0.1, 0.03, 0.03, 0.03] as const;
export const RESIDUAL_BONUS_LEVELS = 10;
export const RESIDUAL_BONUS_RATE = 0.01;
export const ADVERTISER_DIRECT_BONUS_RATE = 0.5;

export const ACCOUNT_STATUSES = {
  active: "active",
  renewalPending: "renewal_pending",
  gracePeriod: "grace_period",
  expired: "expired",
  pointsLost: "points_lost",
} as const;

export type PackageSlug = "start" | "plus" | "pro" | "elite";

export type PackageDefinition = {
  slug: PackageSlug;
  name: string;
  packageValue: number;
  courseFee: number;
  totalPaid: number;
  cycleLimit200: number;
  dailyBonus: number;
};

export type PackageAccounting = {
  package_value: number;
  course_fee: number;
  total_paid: number;
  bonusable_amount: number;
  cycle_limit_200: number;
  amount_counted_for_rewards: number;
  daily_bonus: number;
};

export type BonusLevel = {
  level: number;
  rate: number;
  amount: number;
};

export type VmeLegInput = {
  legId: string;
  label: string;
  points: number;
};

export type VmeLegResult = VmeLegInput & {
  limit: number;
  validPoints: number;
  ignoredPoints: number;
};

export type VmeGoalResult = {
  targetPoints: number;
  grossPoints: number;
  validPoints: number;
  ignoredPoints: number;
  missingPoints: number;
  legs: VmeLegResult[];
};

export const PACKAGE_CATALOG: PackageDefinition[] = [
  buildPackageDefinition("start", "Start", 60),
  buildPackageDefinition("plus", "Plus", 120),
  buildPackageDefinition("pro", "Pro", 300),
  buildPackageDefinition("elite", "Elite", 1000),
];

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function roundPoints(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function buildPackageDefinition(slug: PackageSlug, name: string, packageValue: number): PackageDefinition {
  const normalizedPackageValue = roundMoney(packageValue);

  return {
    slug,
    name,
    packageValue: normalizedPackageValue,
    courseFee: COURSE_FEE_USD,
    totalPaid: roundMoney(normalizedPackageValue + COURSE_FEE_USD),
    cycleLimit200: roundMoney(normalizedPackageValue * 2),
    dailyBonus: roundMoney(normalizedPackageValue * DAILY_SHARE_BONUS_RATE),
  };
}

export function inferPackageValue(rawValue: number | string | null | undefined) {
  const value = roundMoney(Number(rawValue ?? 0));

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const knownTotal = PACKAGE_CATALOG.find((pkg) => pkg.totalPaid === value);
  if (knownTotal) {
    return knownTotal.packageValue;
  }

  const knownPackage = PACKAGE_CATALOG.find((pkg) => pkg.packageValue === value);
  if (knownPackage) {
    return knownPackage.packageValue;
  }

  if (value === 50) return 60;

  return value;
}

export function buildPackageAccounting(rawValue: number | string | null | undefined): PackageAccounting {
  const packageValue = inferPackageValue(rawValue);

  return {
    package_value: packageValue,
    course_fee: COURSE_FEE_USD,
    total_paid: roundMoney(packageValue + COURSE_FEE_USD),
    bonusable_amount: packageValue,
    cycle_limit_200: calculateCycleLimit200(packageValue),
    amount_counted_for_rewards: packageValue,
    daily_bonus: calculateDailyShareBonus(packageValue),
  };
}

export function calculateCycleLimit200(packageValue: number | string | null | undefined) {
  return roundMoney(inferPackageValue(packageValue) * 2);
}

export function calculatePointsFromAmount(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return roundPoints((Number.isFinite(value) ? value : 0) * POINT_RATE_PER_USD);
}

export function calculateDailyShareBonus(packageValue: number | string | null | undefined) {
  return roundMoney(inferPackageValue(packageValue) * DAILY_SHARE_BONUS_RATE);
}

export function calculateSignupRenewalBonuses(bonusableAmount: number | string | null | undefined): BonusLevel[] {
  const amount = inferPackageValue(bonusableAmount);

  return SIGNUP_RENEWAL_BONUS_MATRIX.map((rate, index) => ({
    level: index + 1,
    rate,
    amount: roundMoney(amount * rate),
  }));
}

export function calculateResidualBonuses(dailyShareBonus: number | string | null | undefined): BonusLevel[] {
  const amount = Number(dailyShareBonus ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return Array.from({ length: RESIDUAL_BONUS_LEVELS }, (_, index) => ({
    level: index + 1,
    rate: RESIDUAL_BONUS_RATE,
    amount: roundMoney(safeAmount * RESIDUAL_BONUS_RATE),
  }));
}

export function calculateAdvertiserDirectBonus(realProfit: number | string | null | undefined) {
  const profit = Number(realProfit ?? 0);
  return roundMoney((Number.isFinite(profit) ? profit : 0) * ADVERTISER_DIRECT_BONUS_RATE);
}

export function capAmountToCycle(availableCycleRoom: number | string | null | undefined, requestedAmount: number | string | null | undefined) {
  const room = Math.max(0, Number(availableCycleRoom ?? 0));
  const requested = Math.max(0, Number(requestedAmount ?? 0));
  return roundMoney(Math.min(room, requested));
}

export function isWithdrawalAmountAllowed(amountUsd: number | string | null | undefined) {
  const amount = Number(amountUsd ?? 0);
  return Number.isFinite(amount) && amount >= MIN_WITHDRAWAL_USD && amount <= MAX_WITHDRAWAL_USD;
}

export function isWithdrawalProcessingDay(date = new Date()) {
  const day = date.getDate();
  return day === 15 || day === 30;
}

export function calculateVmeForGoal(legs: VmeLegInput[], targetPoints: number): VmeGoalResult {
  const target = Math.max(0, Number(targetPoints));
  const limit = roundPoints(target * VME_DIRECT_LEG_LIMIT);
  const normalizedLegs = legs.map((leg) => {
    const points = Math.max(0, Number(leg.points ?? 0));
    const validPoints = Math.min(points, limit);

    return {
      ...leg,
      points: roundPoints(points),
      limit,
      validPoints: roundPoints(validPoints),
      ignoredPoints: roundPoints(Math.max(0, points - validPoints)),
    };
  });

  const grossPoints = normalizedLegs.reduce((sum, leg) => sum + leg.points, 0);
  const validPoints = normalizedLegs.reduce((sum, leg) => sum + leg.validPoints, 0);

  return {
    targetPoints: target,
    grossPoints: roundPoints(grossPoints),
    validPoints: roundPoints(validPoints),
    ignoredPoints: roundPoints(Math.max(0, grossPoints - validPoints)),
    missingPoints: roundPoints(Math.max(0, target - validPoints)),
    legs: normalizedLegs,
  };
}
