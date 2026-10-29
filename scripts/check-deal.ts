// Volume and deal value calculator (lib/deal-calculator.ts): `npm run check:deal`.
import { DEFAULT_PRICE_PER_MINUTE, calculateDeal, dealInputsChanged, industryAverageFor } from "@/lib/deal-calculator";

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const none = { callsPerMonth: null, minutesPerCall: null, pricePerMinute: null, contractMonths: null };

// Industry averages × 5 minutes.
const bank = calculateDeal({ segment: "Bank", ...none });
check("banking: 15,00,000 calls × 5 min = 75,00,000 min", bank.volume === 7_500_000);
check("insurance: 10,00,000 × 5 = 50,00,000 min", calculateDeal({ segment: "Insurance", ...none }).volume === 5_000_000);
check("financial services (NBFC): 8,00,000 × 5 = 40,00,000 min", calculateDeal({ segment: "NBFC", ...none }).volume === 4_000_000);
check("housing finance and wealth use financial services", industryAverageFor("Housing finance")?.callsPerMonth === 800_000 && industryAverageFor("Wealth & AMC")?.callsPerMonth === 800_000);
check("fintech: 5,00,000 × 5 = 25,00,000 min", calculateDeal({ segment: "Fintech", ...none }).volume === 2_500_000);

// Deal value = volume × price × months.
check(`default price is the ₹3–5 midpoint (₹${DEFAULT_PRICE_PER_MINUTE})`, DEFAULT_PRICE_PER_MINUTE === 4);
check("bank deal: 75,00,000 × ₹4 × 12 = ₹36 crore", bank.dealValue === 360_000_000);
check("…with a ₹27–45 crore range at ₹3–5", bank.range?.low === 270_000_000 && bank.range?.high === 450_000_000);
check("defaults are flagged", bank.defaults.calls && bank.defaults.minutes && bank.defaults.price && bank.defaults.months);

// Manual inputs win.
const custom = calculateDeal({ segment: "Bank", callsPerMonth: 15_000, minutesPerCall: 3, pricePerMinute: 3.5, contractMonths: 6 });
check("entered calls/minutes override the industry average", custom.volume === 45_000);
check("entered price and months: 45,000 × ₹3.5 × 6 = ₹9,45,000", custom.dealValue === 945_000);
check("no range when the price was entered", custom.range === null);
check("nothing flagged as default", !Object.values(custom.defaults).some(Boolean));

// Segments without an average need calls.
const other = calculateDeal({ segment: "Healthcare", ...none });
check("healthcare has no average: volume unknown, deal ₹0", other.volume === null && other.dealValue === 0 && other.range === null);
check("…until calls are entered", calculateDeal({ segment: "Healthcare", ...none, callsPerMonth: 20_000 }).volume === 100_000);
check("fractional minutes round to whole minutes", calculateDeal({ segment: "Other", ...none, callsPerMonth: 333, minutesPerCall: 2.5 }).volume === 833);

// Change detection (edits only recalculate when an input moved).
const base = { segment: "Bank", ...none };
check("same inputs: unchanged", !dealInputsChanged(base, { ...base }));
check("segment change counts (it changes the default calls)", dealInputsChanged(base, { ...base, segment: "Fintech" }));
check("price change counts", dealInputsChanged(base, { ...base, pricePerMinute: 5 }));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll deal calculator checks passed");
