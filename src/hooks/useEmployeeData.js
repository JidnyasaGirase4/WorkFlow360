import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../utils/createStore'
import { taskStore, attendanceStore, leaveStore, uploadedDocsStore } from '../utils/portalStores'
import { projects } from '../mockData/projects'
import { meetings } from '../mockData/meetings'
import { portalMeetings } from '../mockData/clientPortal'
import { milestones } from '../mockData/milestones'
import { documents } from '../mockData/documents'
import { employees } from '../mockData/employees'
import { attendanceRecords, leaveEntitlements } from '../mockData/attendance'
import { TODAY } from '../mockData/reference'
import { inclusiveDays } from '../utils/format'

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave']

// Everything the employee portal shows, scoped to the logged-in employee only:
// their assigned tasks, projects they belong to, meetings they attend, their
// own attendance, leave and documents. Nothing falls back to other people's data.
export function useEmployeeData() {
  const { user } = useAuth()
  const allTasks = useStore(taskStore)
  const attendanceState = useStore(attendanceStore)
  const allLeave = useStore(leaveStore)
  const uploadedDocs = useStore(uploadedDocsStore)
  const name = user?.name || ''

  return useMemo(() => {
    const record = employees.find((e) => e.email === user?.email) || null
    const myTasks = allTasks.filter((t) => t.assignee === name)
    const myProjects = projects.filter((p) => p.team.includes(name) || p.manager === name)
    const projectIds = new Set(myProjects.map((p) => p.id))
    const myMeetings = [...meetings, ...portalMeetings].filter((m) => m.participants.includes(name))
    const myMilestones = milestones.filter((m) => projectIds.has(m.projectId))
    const myLeave = allLeave.filter((l) => l.employee === name).sort((a, b) => b.from.localeCompare(a.from))

    // Attendance history + live record for today.
    const history = attendanceRecords.filter((r) => r.employee === name && r.date !== TODAY)
    const live = attendanceState.live[name] || null
    const liveRecord = live
      ? {
          id: `live-${name}`,
          employee: name,
          date: TODAY,
          status: 'present',
          checkIn: live.checkIn,
          checkOut: live.checkOut,
          isLive: true,
        }
      : null

    // Leave balance derived from approved / pending requests in the current year.
    const year = TODAY.slice(0, 4)
    const balance = LEAVE_TYPES.map((type) => {
      const total = leaveEntitlements[type] || 0
      const inYear = myLeave.filter((l) => l.type === type && l.from.startsWith(year))
      const used = inYear.filter((l) => l.status === 'approved').reduce((sum, l) => sum + inclusiveDays(l.from, l.to), 0)
      const pending = inYear.filter((l) => l.status === 'pending').reduce((sum, l) => sum + inclusiveDays(l.from, l.to), 0)
      return { type, total, used, pending, remaining: Math.max(0, total - used - pending) }
    })

    // Own HR documents + files uploaded by the employee + shared project files.
    const projectNames = new Set(myProjects.map((p) => p.name))
    const docs = [
      ...uploadedDocs.filter((d) => d.uploadedBy === name),
      ...documents.filter(
        (d) =>
          (record && d.employeeId === record.id) ||
          d.uploadedBy === name ||
          (d.project && projectNames.has(d.project) && d.visibility !== 'admins' && d.category !== 'Employee Documents')
      ),
    ]

    return {
      user,
      name,
      record,
      tasks: myTasks,
      projects: myProjects,
      meetings: myMeetings,
      milestones: myMilestones,
      leave: myLeave,
      leaveBalance: balance,
      attendanceHistory: liveRecord ? [liveRecord, ...history] : history,
      liveAttendance: live,
      documents: docs,
    }
  }, [user, name, allTasks, attendanceState, allLeave, uploadedDocs])
}
