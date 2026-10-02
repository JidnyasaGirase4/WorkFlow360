import { leads } from '../mockData/leads'
import { createMockService } from './createMockService'

const CREATED = {
  'ld-1': '2026-09-08',
  'ld-2': '2026-08-27',
  'ld-3': '2026-09-02',
  'ld-4': '2026-08-19',
  'ld-5': '2026-08-30',
  'ld-6': '2026-08-11',
  'ld-7': '2026-08-05',
  'ld-8': '2026-09-11',
}

// Leads carry their notes as a list so the details page can add notes inline.
const seeded = leads.map((lead) => ({
  ...lead,
  createdDate: CREATED[lead.id] || lead.lastContact,
  noteList: lead.notes
    ? [{ id: `${lead.id}-note-1`, author: lead.owner, text: lead.notes, time: `${lead.lastContact}T10:30:00` }]
    : [],
}))

export const leadService = createMockService(seeded, 'id')
