import React from 'react'
import { motion } from 'framer-motion'
import { ShieldWarning, Terminal, PencilSimple, Globe, Wrench } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import type { PermissionRequest } from '../../shared/types'

interface Props {
  tabId: string
  permission: PermissionRequest
  queueLength?: number
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Bash: <Terminal size={14} />,
  Edit: <PencilSimple size={14} />,
  Write: <PencilSimple size={14} />,
  WebSearch: <Globe size={14} />,
  WebFetch: <Globe size={14} />,
}

function getToolIcon(name: string) {
  return TOOL_ICONS[name] || <Wrench size={14} />
}

const SENSITIVE_FIELD_RE = /token|password|secret|key|auth|credential|api.?key/i

function formatInput(input?: Record<string, unknown>): string | null {
  if (!input) return null
  const entries = Object.entries(input)
  if (entries.length === 0) return null

  const parts: string[] = []
  for (const [key, value] of entries) {
    // Defense-in-depth: mask sensitive fields (backend already masks too)
    if (SENSITIVE_FIELD_RE.test(key)) {
      parts.push(`${key}: ***`)
      continue
    }
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    const truncated = val.length > 120 ? val.substring(0, 117) + '...' : val
    parts.push(`${key}: ${truncated}`)
  }
  return parts.join('\n')
}

function getButtonClasses(isAllow: boolean, isDeny: boolean): string {
  const base =
    'text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  if (isAllow) {
    return `${base} bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/20`
  }
  if (isDeny) {
    return `${base} bg-red-500/10 border border-red-500/[0.22] text-red-400 hover:bg-red-500/[0.18]`
  }
  return `${base} bg-accent/10 border border-accent/[0.15] text-accent hover:bg-accent/15`
}

export function PermissionCard({ tabId, permission, queueLength = 1 }: Props) {
  const respondPermission = useSessionStore((s) => s.respondPermission)
  const [responded, setResponded] = React.useState(false)

  // Reset responded flag when the displayed permission changes (queue advancing)
  React.useEffect(() => {
    setResponded(false)
  }, [permission.questionId])

  const handleOption = (optionId: string) => {
    if (responded) return // Prevent double-send
    setResponded(true)
    respondPermission(tabId, permission.questionId, optionId)
  }

  const inputPreview = formatInput(permission.toolInput)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="mx-4 mt-2 mb-2"
    >
      <div className="overflow-hidden bg-surface-hover border border-beat/30 rounded-xl">
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-beat/[0.06] border-b border-beat/[0.12]">
          <ShieldWarning size={12} className="text-accent" />
          <span className="text-[11px] font-semibold text-accent">
            Permission Required
          </span>
        </div>

        <div className="px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-txt-muted">{getToolIcon(permission.toolTitle)}</span>
            <span className="text-[12px] font-medium text-txt-primary">
              {permission.toolTitle}
            </span>
          </div>

          {permission.toolDescription && (
            <p className="text-[11px] leading-[1.4] mb-1.5 text-txt-secondary">
              {permission.toolDescription}
            </p>
          )}

          {inputPreview && (
            <pre className="text-[10px] leading-[1.4] px-2 py-1.5 rounded-md overflow-x-auto whitespace-pre-wrap break-all mb-2 bg-surface text-txt-secondary max-h-20">
              {inputPreview}
            </pre>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {permission.options.map((opt) => {
              const isAllow = opt.kind === 'allow' || opt.label.toLowerCase().includes('allow')
                || opt.label.toLowerCase().includes('yes')
              const isDeny = opt.kind === 'deny' || opt.label.toLowerCase().includes('deny')
                || opt.label.toLowerCase().includes('no') || opt.label.toLowerCase().includes('reject')

              return (
                <button
                  key={opt.optionId}
                  onClick={() => handleOption(opt.optionId)}
                  disabled={responded}
                  className={getButtonClasses(isAllow, isDeny)}
                >
                  {opt.label}
                </button>
              )
            })}

            {queueLength > 1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                +{queueLength - 1} more
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
