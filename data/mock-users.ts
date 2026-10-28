import type { User } from "@/types/user";

// Stable ids so later phases (auth, ownership) can reference these users.
export const mockUsers: User[] = [
  {
    id: "u_admin",
    name: "Admin User",
    email: "admin@company.com",
    role: "admin",
    title: "Chief Growth Officer",
    status: "active",
    joinedAt: "2025-06-02",
  },
  {
    id: "u_priya",
    name: "Priya Sharma",
    email: "priya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-08-18",
  },
  {
    id: "u_rohan",
    name: "Rohan Mehta",
    email: "rohan@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2025-11-03",
  },
  {
    id: "u_ananya",
    name: "Ananya Iyer",
    email: "ananya@company.com",
    role: "sales_agent",
    title: "Sales Executive",
    status: "active",
    joinedAt: "2026-01-12",
  },
  {
    id: "u_karan",
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
