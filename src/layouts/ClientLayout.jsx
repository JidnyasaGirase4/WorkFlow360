import DashboardLayout from './DashboardLayout'
import { clientNav } from './navConfig'

export default function ClientLayout() {
  return (
    <DashboardLayout
      panel="client"
      nav={clientNav}
      title="Client Dashboard"
      homeHref="/client/dashboard"
      profileHref="/client/profile"
      settingsHref="/client/settings"
      messagesHref="/client/messages"
      messagesUnread
    />
  )
}
