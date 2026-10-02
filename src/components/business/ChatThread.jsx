import { useEffect, useRef, useState } from 'react'
import { Send, Paperclip, Lock, X, FileText, Download, MessageCircle } from 'lucide-react'
import Avatar from '../common/Avatar'
import Button from '../common/Button'
import Switch from '../common/Switch'
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB, toAttachment, validateAttachment } from '../../utils/attachments'
import { formatDateTime } from '../../utils/format'
import { cn } from '../../utils/cn'

// Support-chat conversation: agent (right) vs client (left) bubbles, internal notes,
// attachments, a typing indicator and a composer that sends with Enter.
export default function ChatThread({ messages, onSend, typingName, disabled = false, sending = false }) {
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const endRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' })
  }, [messages.length, typingName])

  const canSend = (text.trim().length > 0 || files.length > 0) && !disabled && !sending

  function submit() {
    if (!canSend) return
    onSend({ text: text.trim(), internal, attachments: files.map(toAttachment) })
    setText('')
    setFiles([])
    setFileError('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  function handleFiles(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (picked.length === 0) return
    const errors = picked.map(validateAttachment).filter(Boolean)
    setFileError(errors[0] || '')
    setFiles((prev) => [...prev, ...picked.filter((f) => !validateAttachment(f))].slice(0, 5))
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[min(30rem,62dvh)] min-h-[14rem] space-y-5 overflow-y-auto overflow-x-hidden bg-ink-50/50 px-3 py-5 sm:px-5 dark:bg-ink-950/30" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
              <MessageCircle size={22} />
            </span>
            <p className="text-sm text-ink-400">No messages yet. Start the conversation below.</p>
          </div>}
        {messages.map((msg, idx) => (
          <Message key={`${msg.time}-${idx}`} msg={msg} />
        ))}
        {typingName && (
          <div className="flex items-end gap-2.5" aria-live="polite">
            <Avatar name={typingName} size="sm" />
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-ink-100 bg-white px-4 py-3 shadow-card dark:border-ink-700 dark:bg-ink-800" role="status" aria-label={`${typingName} is typing`}>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
            <span className="pb-1 text-xs text-ink-400">{typingName.split(' ')[0]} is typing…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={cn('border-t p-3 transition-colors sm:p-4', internal ? 'border-warning-200 bg-warning-50/70 dark:border-warning-500/30 dark:bg-warning-500/5' : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Switch checked={internal} onChange={(e) => setInternal(e.target.checked)} label="Internal note" description={internal ? 'Only your team can see this' : 'Visible to the client'} />
        </div>
        <label htmlFor="chat-composer" className="sr-only">
          {internal ? 'Write an internal note' : 'Write a reply to the client'}
        </label>
        <textarea
          id="chat-composer"
          rows={3}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={internal ? 'Add an internal note for your team…' : 'Type your reply… (Enter to send, Shift + Enter for a new line)'}
          className={cn('focus-ring w-full resize-none rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink-800 shadow-sm transition-colors placeholder:text-ink-400 focus:border-brand-400 dark:bg-ink-900 dark:text-ink-100', internal ? 'border-warning-300 dark:border-warning-500/40' : 'border-ink-200 dark:border-ink-700')}
        />
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white py-1 pl-2 pr-1 text-xs text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
                <FileText size={12} /> <span className="max-w-[10rem] truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="focus-ring rounded p-0.5 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label={`Remove ${f.name}`}>
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {fileError && <p className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{fileError}</p>}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" leftIcon={<Paperclip size={14} />} onClick={() => fileRef.current?.click()} disabled={disabled}>
              Attach
            </Button>
            <span className="hidden text-xs text-ink-400 sm:inline">Max {MAX_ATTACHMENT_MB} MB per file</span>
            <input ref={fileRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="sr-only" tabIndex={-1} onChange={handleFiles} aria-label="Attach files" />
          </div>
          <Button type="button" size="sm" onClick={submit} disabled={!canSend} isLoading={sending} rightIcon={<Send size={14} />} className="min-w-[6rem]">
            {internal ? 'Add note' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isAgent = msg.role === 'employee'
  const isInternal = Boolean(msg.internal)
  return (
    <div className={cn('flex animate-fade-in items-end gap-2.5', isAgent ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar name={msg.from} size="sm" />
      <div className={cn('flex min-w-0 max-w-[calc(100%-2.75rem)] flex-col gap-1 sm:max-w-[75%]', isAgent ? 'items-end' : 'items-start')}>
        <span className="flex max-w-full flex-wrap items-center gap-x-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">
          {msg.from}
          <span className="font-normal text-ink-400">{isAgent ? '· Support agent' : '· Client'}</span>
        </span>
        <div
          className={cn(
            'min-w-0 rounded-2xl px-4 py-2.5 text-sm shadow-card',
            isInternal
              ? 'rounded-br-sm border border-dashed border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-100'
              : isAgent
                ? 'rounded-br-sm border border-brand-100 bg-brand-50 text-ink-800 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-ink-50'
                : 'rounded-bl-sm border border-ink-100 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200'
          )}
        >
          {isInternal && (
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
              <Lock size={11} /> Internal note
            </span>
          )}
          {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
          {msg.attachments?.length > 0 && (
            <ul className={cn('flex flex-col gap-1.5', msg.text && 'mt-2')}>
              {msg.attachments.map((a) => (
                <li key={a.name} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs', isAgent && !isInternal ? 'bg-white/80 dark:bg-ink-900/50' : 'bg-white/70 dark:bg-ink-900/60')}>
                  <FileText size={13} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="shrink-0 opacity-70">{a.size}</span>
                  <Download size={12} className="shrink-0 opacity-70" aria-hidden="true" />
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="text-xs text-ink-400">{formatDateTime(msg.time)}</span>
      </div>
    </div>
  )
}
