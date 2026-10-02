import { clients } from '../mockData/clients'
import { createMockService } from './createMockService'

export const clientService = createMockService(clients, 'id')
