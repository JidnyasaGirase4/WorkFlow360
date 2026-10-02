import { attendanceRecords, leaveRequests } from '../mockData/attendance'
import { createMockService } from './createMockService'

export const attendanceService = createMockService(attendanceRecords, 'id')
export const leaveService = createMockService(leaveRequests, 'id')
