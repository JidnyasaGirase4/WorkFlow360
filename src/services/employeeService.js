import { employees } from '../mockData/employees'
import { createMockService } from './createMockService'

export const employeeService = createMockService(employees, 'id')
