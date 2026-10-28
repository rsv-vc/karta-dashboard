// Monthly targets per sales agent. Mock values until targets are managed in
// the admin area (and stored in the database from Phase 9).

export interface MonthlyTarget {
  /** Rupees of deals won in the month. */
  wonValue: number;
  /** New leads added in the month. */
  newLeads: number;
}

export const MONTHLY_TARGETS: Record<string, MonthlyTarget> = {
  u_priya: { wonValue: 4_000_000, newLeads: 8 },
  u_rohan: { wonValue: 2_500_000, newLeads: 6 },
  u_ananya: { wonValue: 2_500_000, newLeads: 6 },
  u_karan: { wonValue: 1_500_000, newLeads: 4 },
};

const DEFAULT_TARGET: MonthlyTarget = { wonValue: 2_000_000, newLeads: 5 };

export function getTargetFor(userId: string): MonthlyTarget {
  return MONTHLY_TARGETS[userId] ?? DEFAULT_TARGET;
}
