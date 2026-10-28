import { z } from "zod";
import { CITIES, COMPANY_SIZES, INDUSTRIES, PRIORITIES, SOURCES, STAGE_VALUES, TODAY } from "@/lib/constants";
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

export const leadFormSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name").max(120),
  industry: z.enum(INDUSTRIES, "Pick an industry"),
  companySize: z.enum(COMPANY_SIZES, "Pick a company size"),
  city: z.enum(CITIES, "Pick a city"),
  pocName: z.string().trim().min(2, "Enter the contact's name").max(80),
  pocDesignation: z.string().trim().min(2, "Enter their designation").max(80),
  pocEmail: z.email("Enter a valid email"),
  pocPhone: z.string().refine(isIndianMobile, "Enter a 10-digit Indian mobile number"),
  pocLinkedIn: z
    .string()
    .refine((v) => v === "" || /^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(v), "Enter a linkedin.com URL or leave empty"),
  source: z.enum(SOURCES, "Pick a source"),
  priority: z.enum(PRIORITIES, "Pick a priority"),
  dealValue: z
    .number("Enter a deal value in rupees")
    .int("Use whole rupees")
    .min(10_000, "Minimum ₹10,000")
    .max(1_000_000_000, "Maximum ₹100 crore"),
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
    lostReason: z.string().trim().max(300),
    finalDealValue: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.to === "lost" && v.lostReason.length < 3) {
      ctx.addIssue({ code: "custom", path: ["lostReason"], message: "Say why the lead was lost" });
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
