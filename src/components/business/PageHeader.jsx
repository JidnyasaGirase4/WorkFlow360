import Breadcrumb from '../common/Breadcrumb'

// Page title block: breadcrumb above, bold title, muted description, actions on
// the right (wrapping under the title on phones, buttons share the row).
export default function PageHeader({ title, description, breadcrumbItems, action, homeHref }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0">
        {breadcrumbItems && <Breadcrumb items={breadcrumbItems} homeHref={homeHref} />}
        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl dark:text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      </div>
      {action && (
        <div className="w-full shrink-0 sm:w-auto sm:max-w-[60%] [&>div]:flex-wrap sm:[&>div]:justify-end max-sm:[&>div]:w-full max-sm:[&>div>*]:min-w-[8.5rem] max-sm:[&>div>*]:flex-1 max-sm:[&>button]:w-full">
          {action}
        </div>
      )}
    </div>
  )
}
