import { milestones } from '../mockData/milestones'
import { createMockService } from './createMockService'

export const milestoneService = createMockService(milestones, 'id')
