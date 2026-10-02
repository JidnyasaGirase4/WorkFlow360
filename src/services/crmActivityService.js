import { crmActivities } from '../mockData/crmActivities'
import { createMockService } from './createMockService'

export const crmActivityService = createMockService(crmActivities, 'id')
