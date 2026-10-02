import { contacts } from '../mockData/contacts'
import { createMockService } from './createMockService'

export const contactService = createMockService(contacts, 'id')
