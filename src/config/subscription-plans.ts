export const subscriptionPlans = {
  individual: { seats: 1, monthlyReports: 10 },
  'small-team': { seats: 5, monthlyReports: 25 },
  branch: { seats: 10, monthlyReports: 50 },
} as const;

export type SubscriptionPlanId = keyof typeof subscriptionPlans;

export const isSubscriptionPlanId = (value: string): value is SubscriptionPlanId =>
  Object.prototype.hasOwnProperty.call(subscriptionPlans, value);

export const getSubscriptionMonthlyReportAllowance = (
  planId: string | null,
  seatLimit: number,
  fallback: number,
) => {
  if (planId && isSubscriptionPlanId(planId)) {
    return subscriptionPlans[planId].monthlyReports;
  }

  const legacyPlan = Object.values(subscriptionPlans).find(
    (plan) => plan.seats === seatLimit,
  );
  return legacyPlan?.monthlyReports ?? fallback;
};
