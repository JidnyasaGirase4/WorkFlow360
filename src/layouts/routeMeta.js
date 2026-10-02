// Resolves the current route to a human readable page label (and its nav
// section) using the role's nav config. Longest matching href wins so that
// /admin/employees/attendance resolves to "Attendance", not "Employees".
export function getRouteMeta(nav, pathname) {
  let best = null
  for (const group of nav || []) {
    for (const item of group.items) {
      const match = pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (match && (!best || item.href.length > best.item.href.length)) {
        best = { item, section: group.section }
      }
    }
  }
  return best ? { label: best.item.label, section: best.section, href: best.item.href } : null
}
