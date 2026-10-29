// Recalculates every account's volume and deal value from its calculator inputs
// (lib/deal-calculator.ts): `npx tsx --env-file=.env.local scripts/recalculate-deals.mts [--write]`.
// Dry run by default. Won accounts keep a final value recorded when they were won.
import { createClient } from "@supabase/supabase-js";
import { calculateDeal } from "@/lib/deal-calculator";
import { formatINRShort, formatNumber } from "@/lib/utils";
import type { Database } from "@/types/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
const WRITE = process.argv.includes("--write");
const db = createClient<Database>(url, secret, { auth: { persistSession: false } });

const { data, error } = await db
  .from("leads")
  .select("id, stage, industry, calls_per_month, minutes_per_call, price_per_minute, contract_months, volume, deal_value")
  .order("id");
if (error) throw error;

let changed = 0;
let openValue = 0;
let openVolume = 0;
const unknownVolume: string[] = [];
for (const row of data) {
  const deal = calculateDeal({
    segment: row.industry,
    callsPerMonth: row.calls_per_month,
    minutesPerCall: row.minutes_per_call === null ? null : Number(row.minutes_per_call),
    pricePerMinute: row.price_per_minute === null ? null : Number(row.price_per_minute),
    contractMonths: row.contract_months,
  });
  const keepFinal = row.stage === "won" && row.deal_value > 0;
  const next = { volume: deal.volume, deal_value: keepFinal ? row.deal_value : deal.dealValue };
  if (deal.volume === null) unknownVolume.push(row.id);
  if (row.stage !== "won" && row.stage !== "lost") {
    openValue += next.deal_value;
    openVolume += next.volume ?? 0;
  }
  if (next.volume === row.volume && next.deal_value === row.deal_value) continue;
  changed++;
  if (WRITE) {
    const res = await db.from("leads").update(next).eq("id", row.id);
    if (res.error) throw new Error(`${row.id}: ${res.error.message}`);
  }
}

console.log(`${data.length} accounts, ${changed} ${WRITE ? "updated" : "would change"}`);
console.log(`open accounts: ${formatINRShort(openValue)} deal value, ${formatNumber(openVolume)} min / month`);
console.log(`volume unknown (segment without an average and no calls entered): ${unknownVolume.length}`);
if (!WRITE) console.log("Dry run: add --write to save.");
