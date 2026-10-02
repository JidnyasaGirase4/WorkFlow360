import { tasks, taskDetailsSeed } from '../mockData/tasks'
import { createMockService } from './createMockService'

// Task records carry their comments, attachments and history so the details
// drawer works identically on the Tasks page and inside a project.
const seeded = tasks.map((task) => ({ ...task, ...taskDetailsSeed[task.id] }))

export const taskService = createMockService(seeded, 'id')
