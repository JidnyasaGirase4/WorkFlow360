import { leadService } from './leadService'
import { clientService } from './clientService'
import { contactService } from './contactService'
import { crmActivityService } from './crmActivityService'
import { newId, todayKey } from '../utils/workspace'
import { formatCurrency } from '../utils/format'

// Converts a lead into a client record: creates the client, marks the lead as
// won and linked, re-links the matching contact and logs the conversion.
export async function convertLeadToClient(lead) {
  const now = new Date().toISOString()
  const client = await clientService.create({
    id: newId('cl'),
    company: lead.company,
    logo: null,
    industry: '',
    contactPerson: lead.name,
    email: lead.email,
    phone: lead.phone,
    city: '',
    status: 'active',
    revenue: 0,
    outstanding: 0,
    activeProjects: 0,
    lastActivity: now,
    since: todayKey(),
    sourceLeadId: lead.id,
  })

  const updatedLead = await leadService.update(lead.id, {
    status: 'won',
    convertedClientId: client.id,
    nextFollowUp: null,
  })

  const contact = contactService.getSnapshot().find((c) => c.email.toLowerCase() === lead.email.toLowerCase())
  if (contact) await contactService.update(contact.id, { clientId: client.id })

  await crmActivityService.create({
    id: newId('crm-act'),
    type: 'note',
    subject: `Lead converted to client — ${lead.company}`,
    notes: `${lead.name} was converted from a ${lead.source} lead with an estimated deal value of ${formatCurrency(lead.value)}.`,
    contact: lead.name,
    company: lead.company,
    leadId: lead.id,
    clientId: client.id,
    owner: lead.owner,
    date: now,
    outcome: 'Logged',
  })

  return { client, lead: updatedLead }
}
