# Phase 11 prompt: the Karta sales MIS model and real data

```text
You are a senior full-stack engineer on the Karta Lead Tracker (Phases 1–10 done: Next.js 16 on Vercel, Supabase
with RLS, admin-managed accounts, CI). The team's real tracker is the workbook Karta_Sales_MIS_Tracker_1.xlsx
(Accounts, Pipeline Overview, Monthly Funnel, Funnel Health, Scoring Guide). Make the app speak that model, then
replace the demo with the real accounts.

## 0. Rules
- The repository is public. The workbook and anything derived from it (account names, contacts, notes) are never
  committed: the importer reads the file from the local disk and writes straight to the database.
- Real data lives only in the karta-dashboard project. Automated tests run against a separate free project,
  karta-test, seeded with fictional demo data. No test ever signs in to the real project.
- Migrations apply to both projects; regenerate types; advisors clean.

## 1. Sales model (from the Scoring Guide)
- Stages, main path: Not met yet → Discovery done → Follow-up / deep dive → Bot / technical round → POC pitched →
  POC approved → POC ongoing → Won. Exits: No-show (a booked discovery missed), Deferred (interested, later),
  Lost (another vendor or a hard blocker).
- Moves: forward to any later main-path stage (real deals skip steps); No-show only before discovery; Deferred
  and Lost from any open stage; No-show and Deferred can re-open (back onto the main path); Won and Lost are final.
- Stage points: Won 15, POC ongoing 14, POC approved 13, POC pitched 12, Bot/technical 11, Follow-up 9,
  Discovery done 5, Deferred 3, No-show 2, Not met yet 1, Lost 0.
- Score (/40) = stage points + responsiveness (0–10) + decision access (0–10) + timing/budget (0–5), computed by
  the app (never typed). Bands: Hot ≥ 30, Warm 20–29, Nurture 10–19, Inactive < 10, each with its playbook line.

## 2. Account fields
Add: segment (NBFC, Fintech, Housing finance, Bank, Insurance, Wealth & AMC, Healthcare, Other), lead source
(Pipeloom, Voice Bot campaign, Head of Growth, plus the existing ones), discovery month and date, volume, the three
score inputs, latest update (+ date), next step (+ date; replaces "next follow-up"), source-tracker status (read
only, from imports). Keep ₹ deal value (optional) next to volume. POC email/phone, city, industry and company size
become optional (the workbook keeps contact details in the source trackers).

## 3. Who owns what
- Admins (employees, @getkarta.ai) can own accounts as well as manage everyone's: the Head of Growth is an admin
  who brings leads.
- Sales agents (Pipeloom, Voice Bot team: one login each) see only their own accounts in full and the masked
  directory for the rest.

## 4. Home page for every role (from the summary sheets)
- Pipeline overview: funnel from discovery (count and % of discoveries at each step), band × source, stage and
  segment counts. Agents see their own numbers; admins the team's.
- Monthly funnel: discoveries per month by source, no-shows, show rate, and how far each month's group has moved.
- Next steps with a date (soonest first), overdue flagged.
- Funnel health: the problem → fix → owner → due → status tracker, editable by admins, readable by all.
- Scoring guide as a reference panel.

## 5. Import (scripts/import-mis.mts, run locally)
- Reads the workbook path given on the command line; never copies it into the repo.
- Stage from "Status in source tracker" where the short Stage column is ambiguous (Bot_Test → Bot/technical round,
  POC Pitched/Ongoing/Approved → those stages; Meeting Done → Discovery done; Initiated/Connected/To be reached →
  Not met yet; "No Show …" → No-show); Deferred, Lost and Won as written.
- Owners: Pipeloom (Manish / Ishwar) → the Pipeloom agent, Voice Bot team → the Voice Bot agent, Head of Growth →
  the Head of Growth admin (matched by email given on the command line).
- Won-only rows (PhonePe … SETU) come in as Won customers; Incred merges into InCred, Avaas into Aavas Financiers;
  rows with only a company name are skipped and listed.
- Funnel Health rows import into the tracker. A dry run prints counts and every decision before writing.

## 6. Cut-over
1. Ship the new version (demo still on). 2. The admin adds the real accounts on Team → Add member.
3. Import. 4. Remove the demo accounts and data, set NEXT_PUBLIC_DEMO_MODE=false and the real calendar
   (no NEXT_PUBLIC_APP_TODAY), redeploy.

## Decisions (confirmed by the user)
1. Demo sign-in is turned off; the live link becomes the real workspace.
2. Head of Growth is an admin who also owns leads; Pipeloom and Voice Bot team are sales agents.
3. Won-only rows import as customers, with the two duplicates merged.
4. Keep both ₹ deal value and volume.
5. The admin creates the real accounts on Team → Add member before the import.
6. Company domain stays getkarta.ai only.
7. Tests move to a separate free Supabase project, karta-test.
```
