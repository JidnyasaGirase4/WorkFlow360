import { users } from '../mockData/users'
import { createMockService } from './createMockService'

export const userService = createMockService(users, 'id')
