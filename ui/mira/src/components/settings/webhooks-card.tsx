import { Loader2, Send, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"

type Webhook = {
  id: string
  name: string
  url_masked: string
  events: string[]
  enabled: boolean
  format: string
}

type EventOption = { value: string; label: string }

const FORMAT_LABEL: Record<string, string> = {
  slack: "Slack",
  teams: "Teams",
  generic: "Webhook",
}

// The API returns `{detail: "..."}` for errors; postJson/putJson wrap the body
// as `API error NNN: <body>`. Strip the prefix and recover the detail string.
function parseDetail(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  try {
    const parsed = JSON.parse(raw.replace(/^API error \d+: /, ""))
    if (parsed?.detail)
      return typeof parsed.detail === "string"
        ? parsed.detail
        : JSON.stringify(parsed.detail)
  } catch {
    /* ignore */
  }
  return raw
}

export function WebhooksCard() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; detail: string }>
  >({})
  const [testing, setTesting] = useState<string | null>(null)

  const load = async () => {
    const data = await api.getWebhooks()
    setWebhooks(data.webhooks)
    setEvents(data.available_events)
    setLoading(false)
  }

  useEffect(() => {
    load().catch((e) => {
      setError(parseDetail(e))
      setLoading(false)
    })
  }, [])

  const toggleNewEvent = (value: string) =>
    setNewEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    )

  const add = async () => {
    setError(null)
    setAdding(true)
    try {
      await api.createWebhook({
        name: name.trim(),
        url: url.trim(),
        events: newEvents.length ? newEvents : events.slice(0, 1).map((e) => e.value),
        enabled: true,
      })
      setName("")
      setUrl("")
      setNewEvents([])
      await load()
    } catch (e) {
      setError(parseDetail(e))
    } finally {
      setAdding(false)
    }
  }

  const toggleEnabled = async (w: Webhook) => {
    await api.updateWebhook(w.id, { enabled: !w.enabled })
    await load()
  }

  const toggleEvent = async (w: Webhook, value: string) => {
    const next = w.events.includes(value)
      ? w.events.filter((e) => e !== value)
      : [...w.events, value]
    await api.updateWebhook(w.id, { events: next })
    await load()
  }

  const remove = async (w: Webhook) => {
    await api.deleteWebhook(w.id)
    setTestResult((r) => {
      const next = { ...r }
      delete next[w.id]
      return next
    })
    await load()
  }

  const test = async (w: Webhook) => {
    setTesting(w.id)
    try {
      const res = await api.testWebhook(w.id)
      setTestResult((r) => ({ ...r, [w.id]: res }))
    } catch (e) {
      setTestResult((r) => ({ ...r, [w.id]: { ok: false, detail: parseDetail(e) } }))
    } finally {
      setTesting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          Send outbound webhooks when Mira finishes (or fails) a review or
          finishes indexing a repo. Paste a Slack or Microsoft Teams incoming
          webhook URL — or any HTTPS endpoint — and Mira auto-formats the
          payload. URLs are stored masked; re-enter only when changing them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {webhooks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No webhooks configured yet.
              </p>
            )}

            {webhooks.map((w) => {
              const result = testResult[w.id]
              return (
                <div key={w.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {w.name || "Untitled webhook"}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {FORMAT_LABEL[w.format] ?? "Webhook"}
                        </span>
                        {!w.enabled && (
                          <span className="text-[10px] text-muted-foreground">
                            disabled
                          </span>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {w.url_masked}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => test(w)}
                        disabled={testing === w.id}
                      >
                        {testing === w.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        <span className="ml-1">Test</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(w)}
                        aria-label="Delete webhook"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={w.enabled}
                        onCheckedChange={() => toggleEnabled(w)}
                      />
                      Enabled
                    </label>
                    {events.map((ev) => (
                      <label
                        key={ev.value}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={w.events.includes(ev.value)}
                          onCheckedChange={() => toggleEvent(w, ev.value)}
                        />
                        {ev.label}
                      </label>
                    ))}
                  </div>

                  {result && (
                    <p
                      className={
                        result.ok
                          ? "text-xs text-muted-foreground"
                          : "text-xs text-destructive"
                      }
                    >
                      {result.ok ? "Test delivered" : "Test failed"} — {result.detail}
                    </p>
                  )}
                </div>
              )
            })}

            {/* Add a new webhook */}
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <h3 className="text-sm font-semibold">Add webhook</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Name (e.g. #eng-reviews)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="https://hooks.slack.com/services/…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {events.map((ev) => (
                  <label
                    key={ev.value}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Checkbox
                      checked={newEvents.includes(ev.value)}
                      onCheckedChange={() => toggleNewEvent(ev.value)}
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={add} disabled={adding || !url.trim()}>
                  {adding && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Add webhook
                </Button>
                <span className="text-xs text-muted-foreground">
                  Defaults to “Review completed” if no events are selected.
                </span>
              </div>
            </div>

            {error && (
              <p className="text-xs break-words text-destructive">{error}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
