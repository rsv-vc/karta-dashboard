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
