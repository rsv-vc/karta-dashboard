import "server-only";
import { mockLeads } from "@/data/mock-leads";
import type { Lead } from "@/types/lead";

// In-memory lead store standing in for a database until Phase 9 (Supabase).
// Seeded from the mock data and kept on globalThis so dev hot-reloads do not
// wipe it. It resets whenever the server process restarts.

interface Store {
  leads: Lead[];
}

const globalForStore = globalThis as typeof globalThis & { __kartaLeadStore?: Store };

function store(): Store {
  globalForStore.__kartaLeadStore ??= { leads: structuredClone(mockLeads) };
  return globalForStore.__kartaLeadStore;
}

export function listLeads(): Lead[] {
  return store().leads;
}

export function findLead(id: string): Lead | undefined {
  return store().leads.find((l) => l.id === id);
}

export function insertLead(lead: Lead): void {
  store().leads.push(lead);
}

export function replaceLead(lead: Lead): void {
  const s = store();
  const index = s.leads.findIndex((l) => l.id === lead.id);
  if (index === -1) throw new Error(`Lead ${lead.id} not found`);
  s.leads[index] = lead;
}

export function removeLead(id: string): void {
  const s = store();
  s.leads = s.leads.filter((l) => l.id !== id);
}

/** "L-1076" after "L-1075"; never reuses an id while the server runs. */
export function nextLeadId(): string {
  const max = store().leads.reduce((m, l) => Math.max(m, Number(l.id.slice(2)) || 0), 1000);
  return `L-${max + 1}`;
}
