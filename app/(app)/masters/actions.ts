"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { STAGE_VALUES } from "@/lib/constants";
import { fetchAppConfig, fetchLeadSummaries } from "@/lib/data/repo";
import { calculateDeal } from "@/lib/deal-calculator";
import { toFieldErrors } from "@/lib/leads/schemas";
import { createClient } from "@/lib/supabase/server";

// Masters (admins only). Each action re-checks the caller; RLS allows writes to
// admins only as well. Changing an industry's average or the pricing defaults
// recalculates the accounts that use those defaults (Won accounts keep the
// value they closed at).

export type MasterResult = { ok: true; recalculated?: number } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const DENIED: MasterResult = { ok: false, error: "Only employees can change the masters" };

async function admin(): Promise<boolean> {
  return isAdmin(await requireUser());
}

function invalid(error: z.ZodError): MasterResult {
  return { ok: false, error: "Please fix the highlighted fields", fieldErrors: toFieldErrors(error) };
}

function dbError(error: { message: string; code?: string }, what: string): MasterResult {
  if (error.code === "23505") return { ok: false, error: `That ${what} already exists`, fieldErrors: { name: "Already in the list", label: "Already in the list" } };
  if (error.code === "23503") return { ok: false, error: `Accounts still use this ${what}: make it inactive instead` };
  return { ok: false, error: error.message || "Something went wrong. Please try again." };
}

function done(recalculated?: number): MasterResult {
  revalidatePath("/", "layout");
  return { ok: true, recalculated };
}

/** Re-runs the calculator for accounts (all, or one industry's) with the current masters. Won accounts keep their value. */
async function recalculate(industry?: string): Promise<number> {
  const [config, leads] = await Promise.all([fetchAppConfig(), fetchLeadSummaries()]);
  const supabase = await createClient();
  const changes = leads
    .filter((l) => l.stage !== "won" && (industry === undefined || l.industry === industry))
    .map((l) => {
      const deal = calculateDeal(
        { segment: l.industry, callsPerMonth: l.callsPerMonth, minutesPerCall: l.minutesPerCall, pricePerMinute: l.pricePerMinute, contractMonths: l.contractMonths },
        config,
      );
      return { id: l.id, volume: deal.volume, deal_value: deal.dealValue, before: [l.volume, l.dealValue] };
    })
    .filter((c) => c.before[0] !== c.volume || c.before[1] !== c.deal_value);
  const results = await Promise.all(
    changes.map((c) => supabase.from("leads").update({ volume: c.volume, deal_value: c.deal_value }).eq("id", c.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return changes.length;
}

const name = z.string().trim().min(1, "Enter a name").max(60, "Keep it under 60 characters");
const optionalCount = z.number().int("Whole numbers only").min(0, "At least 0").max(1_000_000_000).nullable();
const minutes = z.number("Enter the minutes").positive("More than 0").max(600);

// Industries ------------------------------------------------------------------------------

const industrySchema = z.object({
  /** The current name when editing; empty when adding. */
  original: z.string(),
  name,
  avgCallsPerMonth: optionalCount,
  minutesPerCall: minutes,
  active: z.boolean(),
});

export async function saveIndustry(raw: unknown): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const parsed = industrySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const row = { name: v.name, avg_calls_per_month: v.avgCallsPerMonth, minutes_per_call: v.minutesPerCall, active: v.active };
  const { error } = v.original
    ? await supabase.from("industries").update(row).eq("name", v.original)
    : await supabase.from("industries").insert({ ...row, position: 50 });
  if (error) return dbError(error, "industry");
  // Renaming cascades to accounts (on update cascade); recalculate the industry's accounts.
  return done(await recalculate(v.name));
}

export async function deleteIndustry(industry: string): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const supabase = await createClient();
  const { error } = await supabase.from("industries").delete().eq("name", industry);
  return error ? dbError(error, "industry") : done();
}

// Cities ------------------------------------------------------------------------------------

const citySchema = z.object({ original: z.string(), name, active: z.boolean() });

export async function saveCity(raw: unknown): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const parsed = citySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = v.original
    ? await supabase.from("cities").update({ name: v.name, active: v.active }).eq("name", v.original)
    : await supabase.from("cities").insert({ name: v.name, active: v.active, position: 50 });
  if (error) return dbError(error, "city");
  // Accounts store the city as text: carry a rename over to them.
  if (v.original && v.original !== v.name) {
    const { error: moveError } = await supabase.from("leads").update({ city: v.name }).eq("city", v.original);
    if (moveError) return dbError(moveError, "city");
  }
  return done();
}

export async function deleteCity(city: string): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const supabase = await createClient();
  const { error } = await supabase.from("cities").delete().eq("name", city);
  return error ? dbError(error, "city") : done();
}

// Pricing -------------------------------------------------------------------------------------

const price = z.number("Enter a price").min(0, "At least 0").max(1000);
const pricingSchema = z
  .object({
    pricePerMinute: price,
    priceLow: price,
    priceHigh: price,
    minutesPerCall: minutes,
    contractMonths: z.number("Enter the months").int("Whole months only").min(1, "At least 1").max(120, "At most 120"),
  })
  .superRefine((v, ctx) => {
    if (v.priceLow > v.priceHigh) ctx.addIssue({ code: "custom", path: ["priceLow"], message: "Low must not be above high" });
    if (v.pricePerMinute < v.priceLow || v.pricePerMinute > v.priceHigh) {
      ctx.addIssue({ code: "custom", path: ["pricePerMinute"], message: "Keep the default inside the range" });
    }
  });

export async function savePricing(raw: unknown): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const parsed = pricingSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      price_per_minute: v.pricePerMinute,
      price_low: v.priceLow,
      price_high: v.priceHigh,
      minutes_per_call: v.minutesPerCall,
      contract_months: v.contractMonths,
    })
    .eq("id", true);
  if (error) return dbError(error, "price");
  return done(await recalculate());
}

// Stages ----------------------------------------------------------------------------------------

const stageSchema = z.object({
  stage: z.enum(STAGE_VALUES),
  label: z.string().trim().min(1, "Enter a name").max(40, "Keep it under 40 characters"),
  points: z.number("Enter the points").int("Whole numbers only").min(0, "At least 0").max(20, "At most 20"),
});

export async function saveStage(raw: unknown): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("stage_settings").update({ label: v.label, points: v.points }).eq("stage", v.stage);
  return error ? dbError(error, "stage") : done();
}

// Drop-off reasons --------------------------------------------------------------------------------

const reasonSchema = z.object({
  id: z.number().int().positive().nullable(),
  label: z.string().trim().min(2, "Enter the reason").max(80, "Keep it under 80 characters"),
  appliesTo: z.enum(["lost", "deferred", "both"]),
  active: z.boolean(),
});

export async function saveReason(raw: unknown): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const row = { label: v.label, applies_to: v.appliesTo, active: v.active };
  const { error } = v.id
    ? await supabase.from("drop_reasons").update(row).eq("id", v.id)
    : await supabase.from("drop_reasons").insert({ ...row, position: 50 });
  return error ? dbError(error, "reason") : done();
}

export async function deleteReason(id: number): Promise<MasterResult> {
  if (!(await admin())) return DENIED;
  const supabase = await createClient();
  const { error } = await supabase.from("drop_reasons").delete().eq("id", id);
  return error ? dbError(error, "reason") : done();
}
