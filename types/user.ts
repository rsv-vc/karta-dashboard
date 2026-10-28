export type Role = "admin" | "sales_agent";

export type UserStatus = "active" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Job title shown in the UI, e.g. "Chief Growth Officer". */
  title: string;
  avatarUrl?: string;
  status: UserStatus;
  /** ISO date string. */
  joinedAt: string;
}

/** The narrow user shape resolved from a session and safe to hand to Client Components. */
export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "title">;
