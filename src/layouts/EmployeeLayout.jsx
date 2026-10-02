import DashboardLayout from './DashboardLayout'
import { employeeNav } from './navConfig'

export default function EmployeeLayout() {
  return (
    <DashboardLayout
      panel="employee"
      nav={employeeNav}
      title="Employee Dashboard"
      homeHref="/employee/dashboard"
      profileHref="/employee/profile"
      settingsHref="/employee/settings"
    />
  )
}
