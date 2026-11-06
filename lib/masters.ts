// The Masters page tabs (shared by the server page and the client tabs).

export const MASTER_TABS = [
  { value: "team", label: "Team members" },
  { value: "agents", label: "Sales agents" },
  { value: "industries", label: "Industries" },
  { value: "cities", label: "Cities" },
  { value: "pricing", label: "Pricing" },
  { value: "stages", label: "Stages" },
  { value: "reasons", label: "Lost reasons" },
  { value: "stuck", label: "Why stuck" },
  { value: "competitors", label: "Competitors" },
  { value: "use-cases", label: "Use cases" },
  { value: "directions", label: "Direction" },
] as const;

export type MasterTab = (typeof MASTER_TABS)[number]["value"];
