import { meetings } from '../mockData/meetings'
import { createMockService } from './createMockService'

export const meetingService = createMockService(meetings, 'id')
