import type { User } from "@/types/user";

// Seed input only: the demo team that scripts/seed-supabase.mts and
// scripts/seed-users-sql.ts write to the database, plus the one-click demo
// sign-in list. The app itself reads the team from the profiles table.

/** Fixed auth UUIDs of the demo accounts. */
export const DEMO_USER_IDS = {
  admin: "6f1c2a10-0b6e-4d2a-9b1a-000000000001",
  priya: "6f1c2a10-0b6e-4d2a-9b1a-000000000002",
  rohan: "6f1c2a10-0b6e-4d2a-9b1a-000000000003",
  ananya: "6f1c2a10-0b6e-4d2a-9b1a-000000000004",
  karan: "6f1c2a10-0b6e-4d2a-9b1a-000000000005",
} as const;

export const mockUsers: User[] = [
  {
    id: DEMO_USER_IDS.admin,
    name: "Admin User",
    email: "admin@company.com",
    role: "admin",
    title: "Chief Growth Officer",
    status: "active",
    joinedAt: "2025-06-02",
  },
  {
    id: DEMO_USER_IDS.priya,
    name: "Priya Sharma",
    email: "priya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-08-18",
  },
  {
    id: DEMO_USER_IDS.rohan,
    name: "Rohan Mehta",
    email: "rohan@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-11-03",
  },
  {
    id: DEMO_USER_IDS.ananya,
    name: "Ananya Iyer",
    email: "ananya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2026-01-12",
  },
  {
    id: DEMO_USER_IDS.karan,
    name: "Karan Singh",
    email: "karan@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2026-03-23",
  },
];

export const demoAgents = (): User[] => mockUsers.filter((u) => u.role === "sales_agent");
