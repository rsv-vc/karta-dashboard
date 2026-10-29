import { z } from "zod";
import { COMPANY_SIZES, PRIORITIES, SOURCES, STAGE_VALUES, TODAY } from "@/lib/constants";
import type { ActivityType } from "@/types/lead";

// Form schemas shared by Client Components (react-hook-form) and Server Actions.
// No transforms, so the form's input type equals its output type; the server
// normalizes values (e.g. phone numbers) itself.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** "" or a well-formed YYYY-MM-DD date. */
const dateOrEmpty = z.string().refine((v) => v === "" || DATE_KEY.test(v), "Enter a valid date");

/** "" or a YYYY-MM-DD date on or after TODAY. */
const futureDateOrEmpty = z
  .string()
  .refine((v) => v === "" || (DATE_KEY.test(v) && v >= TODAY), "Pick today or a later date");

/** Optional +91/0 prefix, then 10 digits starting 6–9; spaces and dashes allowed. */
export function isIndianMobile(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

const score = (max: number) =>
  z.number("Enter a score").int("Whole numbers only").min(0, "At least 0").max(max, `At most ${max}`);

export const leadFormSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name").max(120),
  // A name from the Industries master (the database checks it exists).
  industry: z.string().trim().min(1, "Pick a segment").max(60),
  /** "" = not known. */
  companySize: z.enum(["", ...COMPANY_SIZES]),
  city: z.string().trim().max(60, "Keep the city under 60 characters"),
  pocName: z.string().trim().min(2, "Enter the contact's name").max(80),
  pocDesignation: z.string().trim().max(80),
  // Contact details are optional: the sales MIS keeps them in the source trackers.
  pocEmail: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email or leave empty"),
  pocPhone: z.string().refine((v) => v.trim() === "" || isIndianMobile(v), "Enter a 10-digit Indian mobile number or leave empty"),
  pocLinkedIn: z
    .string()
    .refine((v) => v === "" || /^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(v), "Enter a linkedin.com URL or leave empty"),
  source: z.enum(SOURCES, "Pick a source"),
  priority: z.enum(PRIORITIES, "Pick a priority"),
  // Deal calculator inputs; null = the default (lib/deal-calculator.ts). Volume
  // and deal value are always calculated from these on the server.
  callsPerMonth: z.number().int("Whole calls only").min(0, "Cannot be negative").max(100_000_000, "Too large").nullable(),
  minutesPerCall: z.number().positive("More than 0").max(120, "At most 120 minutes").nullable(),
  pricePerMinute: z.number().min(0, "Cannot be negative").max(1000, "At most ₹1,000").nullable(),
  contractMonths: z.number().int("Whole months only").min(1, "At least 1 month").max(120, "At most 120 months").nullable(),
  responsiveness: score(10),
  decisionAccess: score(10),
  timingBudget: score(5),
  nextStep: z.string().trim().max(200, "Keep the next step under 200 characters"),
  // Past dates are allowed here so an overdue lead can still be edited; new
  // follow-ups must be today or later (createLeadSchema / the update action).
  nextFollowUpDate: dateOrEmpty,
  notes: z.string().max(1000, "Keep notes under 1000 characters"),
  /** Admin only; ignored for agents. */
  ownerId: z.string(),
  duplicateAcknowledged: z.boolean(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

/** A new lead: any follow-up must be today or later. */
export const createLeadSchema = leadFormSchema.refine(
  (v) => v.nextFollowUpDate === "" || v.nextFollowUpDate >= TODAY,
  { path: ["nextFollowUpDate"], message: "Pick today or a later date" },
);

export const LOGGABLE_ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const satisfies readonly ActivityType[];

export const logActivitySchema = z.object({
  type: z.enum(LOGGABLE_ACTIVITY_TYPES),
  description: z.string().trim().min(3, "Describe what happened").max(500),
  date: z.string().refine((v) => DATE_KEY.test(v) && v <= TODAY, "Pick today or an earlier date"),
  nextFollowUpDate: futureDateOrEmpty,
});

export type LogActivityValues = z.infer<typeof logActivitySchema>;

export const changeStageSchema = z
  .object({
    to: z.enum(STAGE_VALUES),
    note: z.string().trim().max(300),
    /** Optional details for Lost / Deferred, next to the reason picked from the list. */
    lostReason: z.string().trim().max(300),
    /** A reason from the Drop-off reasons master; required for Lost and Deferred. */
    reasonId: z.number().int().positive().optional(),
    finalDealValue: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.to === "lost" || v.to === "deferred") && !v.reasonId) {
      ctx.addIssue({ code: "custom", path: ["reasonId"], message: "Pick a reason from the list" });
    }
  });

export type ChangeStageValues = z.infer<typeof changeStageSchema>;

export const followUpSchema = z.object({ date: futureDateOrEmpty });

/** Flattens zod issues into { field: firstMessage } for forms. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
