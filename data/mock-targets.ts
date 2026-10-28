import { DEMO_USER_IDS as U } from "@/data/mock-users";

// Seed targets for the demo agents. The app reads targets from the database
// (monthly_targets) and falls back to DEFAULT_TARGET for months without one.

export interface MonthlyTarget {
  /** Rupees of deals won in the month. */
  wonValue: number;
  /** New leads added in the month. */
  newLeads: number;
}

export const MONTHLY_TARGETS: Record<string, MonthlyTarget> = {
  [U.priya]: { wonValue: 4_000_000, newLeads: 8 },
  [U.rohan]: { wonValue: 2_500_000, newLeads: 6 },
  [U.ananya]: { wonValue: 2_500_000, newLeads: 6 },
  [U.karan]: { wonValue: 1_500_000, newLeads: 4 },
};

export const DEFAULT_TARGET: MonthlyTarget = { wonValue: 2_000_000, newLeads: 5 };

export function getTargetFor(userId: string): MonthlyTarget {
  return MONTHLY_TARGETS[userId] ?? DEFAULT_TARGET;
}
