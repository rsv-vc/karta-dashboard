import type { User } from "@/types/user";

// The team directory. App code uses the short ids ("u_priya"); the database
// (Supabase Auth + profiles) uses the fixed authId UUIDs, mapped at the data
// boundary (lib/data/mappers.ts). Adding a person means adding them here and
// seeding the database (scripts/seed-supabase.ts).
export const mockUsers: (User & { authId: string })[] = [
  {
    id: "u_admin",
    authId: "6f1c2a10-0b6e-4d2a-9b1a-000000000001",
    name: "Admin User",
    email: "admin@company.com",
    role: "admin",
    title: "Chief Growth Officer",
    status: "active",
    joinedAt: "2025-06-02",
  },
  {
    id: "u_priya",
    authId: "6f1c2a10-0b6e-4d2a-9b1a-000000000002",
    name: "Priya Sharma",
    email: "priya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-08-18",
  },
  {
    id: "u_rohan",
    authId: "6f1c2a10-0b6e-4d2a-9b1a-000000000003",
    name: "Rohan Mehta",
    email: "rohan@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-11-03",
  },
  {
    id: "u_ananya",
    authId: "6f1c2a10-0b6e-4d2a-9b1a-000000000004",
    name: "Ananya Iyer",
    email: "ananya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2026-01-12",
  },
  {
    id: "u_karan",
    authId: "6f1c2a10-0b6e-4d2a-9b1a-000000000005",
    name: "Karan Singh",
    email: "karan@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2026-03-23",
  },
];

export function getUserById(id: string): User | undefined {
  return mockUsers.find((u) => u.id === id);
}

export function getAgents(): User[] {
  return mockUsers.filter((u) => u.role === "sales_agent");
}

export function getUserByAuthId(authId: string): (User & { authId: string }) | undefined {
  return mockUsers.find((u) => u.authId === authId);
}

/** App id -> database UUID. Throws on unknown ids so bad writes fail loudly. */
export function toAuthId(appId: string): string {
  const user = mockUsers.find((u) => u.id === appId);
  if (!user) throw new Error(`Unknown user ${appId}`);
  return user.authId;
}
