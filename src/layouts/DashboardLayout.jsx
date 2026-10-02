import { useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { getRouteMeta } from './routeMeta'
import { useResetOnChange } from '../hooks/useResetOnChange'

export default function DashboardLayout({
  nav,
  title,
  homeHref,
  profileHref,
  settingsHref,
  showQuickCreate,
  showWorkspaceSwitcher,
  messagesHref,
  messagesUnread = false,
  panel = 'admin',
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Each dashboard has its own colour identity (see [data-panel] in index.css).
  // Set on <html> so portalled UI such as modals and dropdowns follows too.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.panel = panel
    return () => {
      delete root.dataset.panel
    }
  }, [panel])
  const [messagesSeen, setMessagesSeen] = useState(false)
  const location = useLocation()
  const notificationsHref = `${homeHref.replace(/\/dashboard$/, '')}/notifications`
  const meta = getRouteMeta(nav, location.pathname)

  // Close the mobile drawer on navigation and clear the unread-messages dot
  // once the Messages page has been visited (derived during render, no effect).
  useResetOnChange([location.pathname], () => {
    setMobileOpen(false)
    if (messagesHref && location.pathname.startsWith(messagesHref)) setMessagesSeen(true)
  })

  function skipToContent(e) {
    e.preventDefault()
    document.getElementById('main-content')?.focus()
  }

  return (
    <div className="bg-app flex min-h-screen">
      <a href="#main-content" className="skip-link" onClick={skipToContent}>
        Skip to main content
      </a>
      <Sidebar
        nav={nav}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        homeHref={homeHref}
        showWorkspaceSwitcher={showWorkspaceSwitcher}
        panel={panel}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          nav={nav}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          showQuickCreate={showQuickCreate}
          profileHref={profileHref}
          settingsHref={settingsHref}
          notificationsHref={notificationsHref}
          messagesHref={messagesHref}
          messagesUnread={messagesUnread && !messagesSeen}
        />
        <main id="main-content" tabIndex={-1} aria-label={meta?.label || title} className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div role="status" aria-live="polite" className="sr-only">
            {meta ? `${meta.label} page` : ''}
          </div>
          {/* Keyed by pathname so every route change replays the subtle fade/slide-up
              (disabled under prefers-reduced-motion via index.css). */}
          <div key={location.pathname} className="page-enter mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
