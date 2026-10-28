import { z } from "zod";

// The workbook's "Funnel Health" tab: the three funnels from discovery, and for
// each a problem, its fix, an owner, a due date and a status.

export const FUNNELS = {
  1: "Discovery → follow-up",
  2: "Follow-up → bot test / POC",
  3: "POC → paid",
} as const;

export const ACTION_STATUSES = ["open", "started", "scheduled", "pending_approval", "under_review", "done"] as const;
export type ActionStatusValue = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABELS: Record<ActionStatusValue, string> = {
  open: "Open",
  started: "Started",
  scheduled: "Scheduled",
  pending_approval: "Pending approval",
  under_review: "Under review",
  done: "Done",
};

export const funnelActionSchema = z.object({
  funnel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  problem: z.string().trim().min(3, "Describe the problem").max(500),
  fix: z.string().trim().max(500),
  owner: z.string().trim().max(120),
  due: z.string().trim().max(60),
  status: z.enum(ACTION_STATUSES),
});

export type FunnelActionValues = z.input<typeof funnelActionSchema>;
