import { tickets } from '../mockData/tickets'
import { createMockService } from './createMockService'

export const ticketService = createMockService(tickets, 'id')
