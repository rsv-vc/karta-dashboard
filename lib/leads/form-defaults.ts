import { toDateKey } from "@/lib/dates";
import type { LeadFormValues } from "@/lib/leads/schemas";
import type { Lead } from "@/types/lead";

// Starting values for the lead form. Kept out of the component so server pages
// can build them from a stored lead.

/** Empty form; selects stay unset so the user must choose. */
export function emptyLeadForm(): Partial<LeadFormValues> {
  return {
    companyName: "",
    pocName: "",
    pocDesignation: "",
    pocEmail: "",
    pocPhone: "",
    pocLinkedIn: "",
    priority: "medium",
    nextFollowUpDate: "",
    notes: "",
    ownerId: "",
    duplicateAcknowledged: false,
  };
}

export function leadToForm(lead: Lead): LeadFormValues {
  return {
    companyName: lead.companyName,
    industry: lead.industry as LeadFormValues["industry"],
    companySize: lead.companySize,
    city: lead.city as LeadFormValues["city"],
    pocName: lead.pocName,
    pocDesignation: lead.pocDesignation,
    pocEmail: lead.pocEmail,
    pocPhone: lead.pocPhone,
    pocLinkedIn: lead.pocLinkedIn ?? "",
    source: lead.source,
    priority: lead.priority,
    dealValue: lead.dealValue,
    nextFollowUpDate: lead.nextFollowUpAt ? toDateKey(lead.nextFollowUpAt) : "",
    notes: lead.notes,
    ownerId: lead.ownerId,
    duplicateAcknowledged: false,
  };
}
