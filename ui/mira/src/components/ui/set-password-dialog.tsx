import { Loader2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function parseDetail(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  try {
    const parsed = JSON.parse(raw.replace(/^API error \d+: /, ""))
    if (parsed?.error) return parsed.error
    if (parsed?.detail)
      return typeof parsed.detail === "string"
        ? parsed.detail
        : JSON.stringify(parsed.detail)
  } catch {
    /* ignore */
  }
  return raw
}

/**
 * Dialog for setting a password. Used both for self-service change (with the
 * current-password field) and admin reset (without). `onSubmit` receives the
 * current password (empty string when `requireCurrent` is false) and the new
 * password.
 */
export function SetPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  requireCurrent = false,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  requireCurrent?: boolean
  submitLabel?: string
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Clear the fields on close so a previous entry never lingers into the next
  // open (handled here rather than in an effect to avoid a render-time reset).
  const handleOpenChange = (next_: boolean) => {
    if (!next_) {
      setCurrent("")
      setNext("")
      setConfirm("")
      setError(null)
    }
    onOpenChange(next_)
  }

  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit =
    !saving &&
    next.length > 0 &&
    next === confirm &&
    (!requireCurrent || current.length > 0)

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      await onSubmit(current, next)
      handleOpenChange(false)
    } catch (e) {
      setError(parseDetail(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {requireCurrent && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="pw-current">
                Current password
              </label>
              <Input
                id="pw-current"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="pw-new">
              New password
            </label>
            <Input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="pw-confirm">
              Confirm new password
            </label>
            <Input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch || undefined}
            />
            {mismatch && (
              <p className="text-xs text-destructive">Passwords don't match.</p>
            )}
          </div>
          {error && (
            <p className="text-sm break-words text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
