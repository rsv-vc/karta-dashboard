// The Masters page tabs (shared by the server page and the client tabs).

export const MASTER_TABS = [
  { value: "team", label: "Team members" },
  { value: "agents", label: "Sales agents" },
  { value: "industries", label: "Industries" },
  { value: "cities", label: "Cities" },
  { value: "pricing", label: "Pricing" },
  { value: "stages", label: "Stages" },
  { value: "reasons", label: "Drop-off reasons" },
] as const;

export type MasterTab = (typeof MASTER_TABS)[number]["value"];
