import { Badge } from "@/components/ui/badge";
import type { Role } from "@/types/user";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  sales_agent: "Sales agent",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={role === "admin" ? "default" : "secondary"}>{ROLE_LABELS[role]}</Badge>;
}
