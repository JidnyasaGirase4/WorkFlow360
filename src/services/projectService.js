import { projects } from '../mockData/projects'
import { createMockService } from './createMockService'

export const projectService = createMockService(projects, 'id')
