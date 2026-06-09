import {
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useAsync } from "@/lib/hooks"

type Webhook = {
  id: string
  name: string
  url_masked: string
  events: string[]
  enabled: boolean
  format: string
}

type EventOption = { value: string; label: string; description: string }

const FORMAT_LABEL: Record<string, string> = {
  slack: "Slack",
  teams: "Teams",
  generic: "Webhook",
}

export function WebhooksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState(0)
  const { data, loading } = useAsync(() => api.getWebhooks(), [refreshKey])
  const webhooks: Webhook[] = data?.webhooks ?? []
  const events: EventOption[] = data?.available_events ?? []
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; detail: string }>
  >({})

  if (!user?.is_admin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Admin access required.
      </div>
    )
  }

  const labelFor = (value: string) =>
    events.find((e) => e.value === value)?.label ?? value

  const test = async (id: string) => {
    setTesting(id)
    try {
      const res = await api.testWebhook(id)
      setTestResult((r) => ({ ...r, [id]: res }))
    } finally {
      setTesting(null)
    }
  }

  const remove = async (id: string) => {
    await api.deleteWebhook(id)
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Send outbound notifications to Slack, Microsoft Teams, or any HTTPS
            endpoint when Mira reviews a PR or finishes indexing.
          </p>
        </div>
        {webhooks.length > 0 && (
          <Button size="sm" onClick={() => navigate("/settings/webhooks/new")}>
            <Plus className="mr-1 h-4 w-4" /> Add webhook
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <WebhookIcon className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No webhooks yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add a webhook to get notified in Slack, Microsoft Teams, or your
                own endpoint when Mira reviews or indexes.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/settings/webhooks/new")}
            >
              <Plus className="mr-1 h-4 w-4" /> Add webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((w) => {
                const result = testResult[w.id]
                return (
                  <TableRow
                    key={w.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/settings/webhooks/${w.id}`)}
                  >
                    <TableCell className="font-medium">
                      {w.name || "Untitled"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {FORMAT_LABEL[w.format] ?? "Webhook"}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {w.url_masked}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {w.events.length ? (
                          w.events.map((e) => (
                            <Badge key={e} variant="outline">
                              {labelFor(e)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {w.enabled ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Send test"
                          onClick={() => test(w.id)}
                          disabled={testing === w.id}
                        >
                          {testing === w.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Edit"
                          onClick={() => navigate(`/settings/webhooks/${w.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Delete"
                          onClick={() => remove(w.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      {result && (
                        <p
                          className={
                            result.ok
                              ? "mt-1 text-xs text-muted-foreground"
                              : "mt-1 text-xs text-destructive"
                          }
                        >
                          {result.ok ? "Test sent" : "Failed"} — {result.detail}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
