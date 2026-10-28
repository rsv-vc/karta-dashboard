// Prints the SQL that creates the (fictional) demo team in the TEST project's Auth + profiles:
// `npx tsx --env-file=.env.local scripts/seed-users-sql.ts > <file>`, then run it
// in the Supabase SQL editor (or via the MCP execute_sql tool).
// Only a bcrypt hash of DEMO_PASSWORD is printed, never the password itself.
import bcrypt from "bcryptjs";
import { mockUsers } from "@/data/mock-users";

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  console.error("Set DEMO_PASSWORD (12+ characters) in .env.local first");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const users = mockUsers
  .map(
    (u) => `  (${q(u.id)}::uuid, ${q(u.email)}, ${q(u.name)}, ${q(u.role)}::public.app_role, ${q(u.title)}, ${q(u.status)}::public.user_status, ${q(u.joinedAt)}::date)`,
  )
  .join(",\n");

console.log(`-- Demo team: auth accounts (email confirmed) + profiles. Idempotent.
with team (id, email, name, role, title, status, joined_at) as (values
${users}
),
auth_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, ${q(hash)}, now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', name), now(), now(),
    '', '', '', '', '', '', '', ''
  from team
  on conflict (id) do update set encrypted_password = excluded.encrypted_password, email = excluded.email
  returning id
),
identities as (
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
  from team
  where not exists (select 1 from auth.identities i where i.user_id = team.id and i.provider = 'email')
  returning user_id
)
insert into public.profiles (id, name, email, role, title, status, joined_at, is_demo)
select id, name, email, role, title, status, joined_at, true from team
on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role,
  title = excluded.title, status = excluded.status, joined_at = excluded.joined_at, is_demo = true;

-- Freeze the demo calendar (matches NEXT_PUBLIC_APP_TODAY).
update public.app_settings set today = '2026-10-28';`);
