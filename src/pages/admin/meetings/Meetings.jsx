import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, CalendarClock, CalendarDays, CalendarCheck, List } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import MeetingCard from '../../../components/business/MeetingCard'
import MeetingCalendar from '../../../components/business/MeetingCalendar'
import MeetingDrawer from '../../../components/business/MeetingDrawer'
import MeetingFormModal from '../../../components/business/MeetingFormModal'
import Button from '../../../components/common/Button'
import Card from '../../../components/common/Card'
import Tabs from '../../../components/common/Tabs'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import FilterBar from '../../../components/common/FilterBar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { meetingService } from '../../../services/meetingService'
import { MEETING_TYPE_OPTIONS, meetingSortKey, slugify } from '../../../utils/meetingUtils'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { useToast } from '../../../context/ToastContext'

const fetchMeetings = () => meetingService.list()

export default function Meetings() {
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, loading, error, reload, setData } = useAsyncData(fetchMeetings, 'meetings')

  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) setModalOpen(true)
    },
    { immediate: true }
  )

  useEffect(() => {
    if (location.state?.openCreate) navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  const all = useMemo(() => data || [], [data])
  const clientOptions = useMemo(() => [...new Set(all.map((m) => m.client))].sort(), [all])

  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((m) => {
      const matchesSearch =
        !q || m.title.toLowerCase().includes(q) || m.client.toLowerCase().includes(q) || (m.project || '').toLowerCase().includes(q) || m.participants.some((p) => p.toLowerCase().includes(q))
      return matchesSearch && (!typeFilter || m.type === typeFilter) && (!clientFilter || m.client === clientFilter)
    })
  }, [all, search, typeFilter, clientFilter])

  const tabs = useMemo(
    () => [
      { value: 'list', label: 'List', icon: <List size={15} />, count: all.length },
      { value: 'calendar', label: 'Calendar', icon: <CalendarDays size={15} /> },
      { value: 'upcoming', label: 'Upcoming', icon: <CalendarClock size={15} />, count: all.filter((m) => m.status === 'upcoming').length },
      { value: 'completed', label: 'Completed', icon: <CalendarCheck size={15} />, count: all.filter((m) => m.status === 'completed').length },
    ],
    [all]
  )

  const visible = useMemo(() => {
    const sorted = [...scoped]
    if (view === 'upcoming') return sorted.filter((m) => m.status === 'upcoming').sort((a, b) => meetingSortKey(a).localeCompare(meetingSortKey(b)))
    if (view === 'completed') return sorted.filter((m) => m.status === 'completed').sort((a, b) => meetingSortKey(b).localeCompare(meetingSortKey(a)))
    return sorted.sort((a, b) => meetingSortKey(b).localeCompare(meetingSortKey(a)))
  }, [scoped, view])

  // Open the calendar on the month of the next scheduled meeting.
  const calendarStart = useMemo(() => {
    const next = all.filter((m) => m.status === 'upcoming').sort((a, b) => meetingSortKey(a).localeCompare(meetingSortKey(b)))[0]
    return next?.date
  }, [all])

  const selected = all.find((m) => m.id === selectedId) || null
  const activeFilters = [
    typeFilter && { key: 'type', label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter('') },
    clientFilter && { key: 'client', label: `Client: ${clientFilter}`, onRemove: () => setClientFilter('') },
  ].filter(Boolean)
  const hasFilters = Boolean(search) || activeFilters.length > 0

  function clearFilters() {
    setSearch('')
    setTypeFilter('')
    setClientFilter('')
  }

  async function handleCreate(values) {
    setIsSaving(true)
    try {
      const created = await meetingService.create({
        id: `mtg-${Date.now()}`,
        title: values.title,
        client: values.client,
        project: values.project || null,
        date: values.date,
        time: values.time,
        type: values.type,
        link: values.type === 'Video Call' ? values.link || `https://meet.workflow360.app/${slugify(values.title)}` : null,
        participants: values.participants,
        status: 'upcoming',
        notes: values.notes,
      })
      setData((prev) => [created, ...(prev || [])])
      setModalOpen(false)
      toast.success(`Meeting scheduled for ${values.participants.length} participant${values.participants.length === 1 ? '' : 's'}`)
    } catch {
      toast.error('Could not schedule the meeting. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(id, changes) {
    await meetingService.update(id, changes)
    setData((prev) => (prev || []).map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }

  const emptyCopy = {
    list: 'No meetings scheduled yet.',
    upcoming: 'There are no upcoming meetings.',
    completed: 'No completed meetings to show.',
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Schedule and manage meetings with your clients and team."
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Meetings' }]}
        action={
          <Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            Schedule Meeting
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 lg:flex-row lg:items-center dark:border-ink-800 dark:bg-ink-900">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by title, client, project or person..." className="lg:w-80" />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select aria-label="Filter by meeting type" options={[{ value: '', label: 'All types' }, ...MEETING_TYPE_OPTIONS]} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} wrapperClassName="lg:w-40" />
          <Select
            aria-label="Filter by client"
            options={[{ value: '', label: 'All clients' }, ...clientOptions.map((c) => ({ value: c, label: c }))]}
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            wrapperClassName="lg:w-56"
          />
        </div>
      </div>
      {activeFilters.length > 0 && <FilterBar activeFilters={activeFilters} onClearAll={clearFilters} className="mb-4" />}

      <Tabs tabs={tabs} active={view} onChange={setView} className="mb-5" />

      {loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading meetings">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <ErrorState title="Couldn't load meetings" description="There was a problem fetching your meetings. Please try again." onRetry={reload} />
        </Card>
      )}

      {!loading && !error && view === 'calendar' && <MeetingCalendar key={calendarStart} meetings={scoped} initialDate={calendarStart} onOpen={(m) => setSelectedId(m.id)} />}

      {!loading && !error && view !== 'calendar' && visible.length === 0 && (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title={hasFilters ? 'No meetings match your filters' : 'No meetings found'}
            description={hasFilters ? 'Try a different search term or clear the filters.' : emptyCopy[view]}
            actionLabel={hasFilters ? 'Clear filters' : 'Schedule Meeting'}
            onAction={hasFilters ? clearFilters : () => setModalOpen(true)}
          />
        </Card>
      )}

      {!loading && !error && view !== 'calendar' && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          {visible.map((m, i) => (
            <MeetingCard key={m.id} meeting={m} index={i} onOpen={(meeting) => setSelectedId(meeting.id)} />
          ))}
        </div>
      )}

      <MeetingDrawer meeting={selected} onClose={() => setSelectedId(null)} onUpdate={handleUpdate} />
      <MeetingFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} isSaving={isSaving} />
    </div>
  )
}
