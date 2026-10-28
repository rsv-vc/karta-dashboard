// Runs a command with the test project's settings (.env.test.local) taking
// precedence over .env.local: `node scripts/with-test-env.mjs next dev -p 3100`.
// Next.js never overrides variables that are already set, so the app talks to
// karta-test while the normal dev server keeps using the live project.
import { spawn } from "node:child_process";

process.loadEnvFile(".env.test.local");
const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: "inherit", shell: true, env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
