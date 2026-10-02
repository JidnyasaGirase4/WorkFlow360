import { employees } from './employees'
import { addDays, daysBetween } from './reference'

export const attendanceToday = [
  { id: 'att-1', employee: 'Jidnyasa Girase', status: 'present', checkIn: '09:12', checkOut: '18:40' },
  { id: 'att-2', employee: 'Jay Girase', status: 'present', checkIn: '09:05', checkOut: '18:20' },
  { id: 'att-3', employee: 'Rohit Girase', status: 'present', checkIn: '09:32', checkOut: '18:55' },
  { id: 'att-4', employee: 'Sneha Joshi', status: 'wfh', checkIn: '09:20', checkOut: '18:10' },
  { id: 'att-5', employee: 'Amit Kulkarni', status: 'late', checkIn: '10:45', checkOut: '19:00' },
  { id: 'att-6', employee: 'Tanvi Deshpande', status: 'present', checkIn: '09:08', checkOut: '18:15' },
  { id: 'att-7', employee: 'Karthik Reddy', status: 'absent', checkIn: null, checkOut: null },
  { id: 'att-8', employee: 'Pooja Nair', status: 'present', checkIn: '09:15', checkOut: '18:05' },
  { id: 'att-9', employee: 'Ishaan Verma', status: 'present', checkIn: '09:22', checkOut: '18:30' },
  { id: 'att-10', employee: 'Meera Iyer', status: 'present', checkIn: '09:02', checkOut: '18:12' },
  { id: 'att-11', employee: 'Rohan Gupta', status: 'late', checkIn: '10:20', checkOut: '18:50' },
]

export const leaveRequests = [
  { id: 'lv-1', employee: 'Karthik Reddy', type: 'Sick Leave', from: '2026-09-20', to: '2026-09-22', reason: 'Fever and viral infection', status: 'approved', appliedOn: '2026-09-19', decidedBy: 'Jay Girase', decidedOn: '2026-09-19' },
  { id: 'lv-2', employee: 'Sneha Joshi', type: 'Casual Leave', from: '2026-10-02', to: '2026-10-03', reason: 'Family function', status: 'pending', appliedOn: '2026-09-22' },
  { id: 'lv-3', employee: 'Tanvi Deshpande', type: 'Earned Leave', from: '2026-10-14', to: '2026-10-18', reason: 'Personal travel', status: 'pending', appliedOn: '2026-09-21' },
  { id: 'lv-4', employee: 'Rohit Girase', type: 'Casual Leave', from: '2026-08-28', to: '2026-08-28', reason: 'Personal work', status: 'rejected', appliedOn: '2026-08-26', decidedBy: 'Jay Girase', decidedOn: '2026-08-27', rejectionReason: 'Sprint release scheduled on the same day. Please reapply for the following week.' },
  { id: 'lv-5', employee: 'Pooja Nair', type: 'Sick Leave', from: '2026-09-05', to: '2026-09-06', reason: 'Not feeling well', status: 'approved', appliedOn: '2026-09-04', decidedBy: 'Jidnyasa Girase', decidedOn: '2026-09-04' },
  { id: 'lv-6', employee: 'Amit Kulkarni', type: 'Casual Leave', from: '2026-09-29', to: '2026-09-30', reason: 'Home renovation work', status: 'pending', appliedOn: '2026-09-24' },
  { id: 'lv-7', employee: 'Rohit Girase', type: 'Earned Leave', from: '2026-03-09', to: '2026-03-13', reason: 'Family trip to Goa', status: 'approved', appliedOn: '2026-02-20', decidedBy: 'Jay Girase', decidedOn: '2026-02-21' },
  { id: 'lv-8', employee: 'Jay Girase', type: 'Casual Leave', from: '2026-05-04', to: '2026-05-04', reason: 'Bank and passport formalities', status: 'approved', appliedOn: '2026-04-30', decidedBy: 'Jidnyasa Girase', decidedOn: '2026-05-01' },
  { id: 'lv-9', employee: 'Sneha Joshi', type: 'Sick Leave', from: '2026-06-10', to: '2026-06-11', reason: 'Migraine and doctor consultation', status: 'approved', appliedOn: '2026-06-10', decidedBy: 'Jay Girase', decidedOn: '2026-06-10' },
  { id: 'lv-10', employee: 'Amit Kulkarni', type: 'Earned Leave', from: '2026-07-13', to: '2026-07-17', reason: 'Visiting family in Nagpur', status: 'approved', appliedOn: '2026-06-25', decidedBy: 'Jay Girase', decidedOn: '2026-06-26' },
  { id: 'lv-11', employee: 'Meera Iyer', type: 'Casual Leave', from: '2026-10-08', to: '2026-10-09', reason: "Sister's wedding rituals", status: 'pending', appliedOn: '2026-09-25' },
  { id: 'lv-12', employee: 'Tanvi Deshpande', type: 'Casual Leave', from: '2026-06-22', to: '2026-06-22', reason: 'Vehicle registration work', status: 'approved', appliedOn: '2026-06-19', decidedBy: 'Jay Girase', decidedOn: '2026-06-20' },
]

// Remaining balance for the logged-in employee (used by the employee portal).
export const leaveBalance = { earned: 12, casual: 6, sick: 8 }

// Yearly entitlement per leave type used by the admin leave module.
export const leaveEntitlements = {
  'Casual Leave': 12,
  'Sick Leave': 10,
  'Earned Leave': 18,
}

export const holidays = {
  '2026-08-15': 'Independence Day',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-08': 'Diwali (Laxmi Pujan)',
}

function isWeekend(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function timeAt(baseMinutes, jitter) {
  const total = baseMinutes + jitter
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

const APPROVED_LEAVE_DAYS = new Set()
leaveRequests
  .filter((l) => l.status === 'approved')
  .forEach((l) => {
    const span = daysBetween(l.from, l.to)
    for (let i = 0; i <= span; i += 1) APPROVED_LEAVE_DAYS.add(`${l.employee}|${addDays(l.from, i)}`)
  })

function buildHistory() {
  const rows = []
  const roster = employees.filter((e) => e.status !== 'inactive')
  const start = '2026-08-03'
  const end = '2026-09-24'
  const span = daysBetween(start, end)
  roster.forEach((emp, empIdx) => {
    for (let i = 0; i <= span; i += 1) {
      const date = addDays(start, i)
      if (isWeekend(date) || holidays[date] || date < emp.joiningDate) continue
      let status
      let checkIn = null
      let checkOut = null
      if (APPROVED_LEAVE_DAYS.has(`${emp.name}|${date}`)) {
        status = 'leave'
      } else {
        const h = (empIdx * 37 + i * 17 + ((empIdx * i) % 11)) % 100
        if (h < 72) status = 'present'
        else if (h < 84) status = 'wfh'
        else if (h < 94) status = 'late'
        else status = 'absent'
        const jitter = (empIdx * 7 + i * 3) % 24
        if (status === 'present' || status === 'wfh') {
          checkIn = timeAt(9 * 60, jitter)
          checkOut = timeAt(18 * 60, (jitter * 2) % 50)
        } else if (status === 'late') {
          checkIn = timeAt(10 * 60 + 10, jitter * 2)
          checkOut = timeAt(19 * 60, (jitter * 2) % 45)
        }
      }
      rows.push({ id: `ah-${emp.id}-${date}`, employee: emp.name, date, status, checkIn, checkOut })
    }
  })
  return rows
}

// Full attendance log: generated history for Aug-Sep 2026 plus the curated
// records for the most recent working day (2026-09-25).
export const attendanceRecords = [
  ...attendanceToday.map((a) => ({ ...a, id: `ah-ref-${a.id}`, date: '2026-09-25' })),
  ...buildHistory(),
].sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee))
