// Fails if a server-only secret ended up in browser code: `npm run check:secrets`
// (after `next build`). Scans every client bundle for the Supabase secret key
// (its value when set, and the sb_secret_ prefix) and the demo password.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const needles = [
  ["sb_secret_ prefix", "sb_secret_"],
  ["SUPABASE_SECRET_KEY value", process.env.SUPABASE_SECRET_KEY],
  ["DEMO_PASSWORD value", process.env.DEMO_PASSWORD],
].filter(([, value]) => value && value.length >= 8);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|html|json|txt)$/.test(name)) yield path;
  }
}

let scanned = 0;
const leaks = [];
try {
  for (const file of files(root)) {
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const [label, value] of needles) if (text.includes(value)) leaks.push(`${label} in ${file}`);
  }
} catch {
  console.error(`No ${root} folder: run "next build" first`);
  process.exit(1);
}

if (leaks.length > 0) {
  console.error(`✗ Secrets found in client bundles:\n  ${leaks.join("\n  ")}`);
  process.exit(1);
}
console.log(`✓ No secrets in ${scanned} client files (checked: ${needles.map(([l]) => l).join(", ")})`);
