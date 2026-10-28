import type { User } from "@/types/user";

// Team lookups for pure modules. The team itself comes from the database
// (lib/data/repo.ts fetchTeam) or, in check scripts, from the seed fixture.

export type NameOf = (userId: string) => string;

/** id -> display name, with a fallback for people who are no longer on the team. */
export function nameLookup(team: readonly Pick<User, "id" | "name">[], fallback = "Unknown"): NameOf {
  const names = new Map(team.map((u) => [u.id, u.name]));
  return (id) => names.get(id) ?? fallback;
}

/** Active sales agents: the people who can own leads. */
export function activeAgents<T extends Pick<User, "role" | "status">>(team: readonly T[]): T[] {
  return team.filter((u) => u.role === "sales_agent" && u.status === "active");
}
