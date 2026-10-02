import DashboardLayout from './DashboardLayout'
import { adminNav } from './navConfig'

export default function AdminLayout() {
  return (
    <DashboardLayout
      panel="admin"
      nav={adminNav}
      title="Admin Dashboard"
      homeHref="/admin/dashboard"
      profileHref="/admin/settings"
      settingsHref="/admin/settings"
      showQuickCreate
      showWorkspaceSwitcher
    />
  )
}
