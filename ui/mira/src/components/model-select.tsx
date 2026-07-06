import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { useState, type ReactNode } from "react"

export type ModelOption = {
  value: string
  label: string
  recommended?: boolean
}

// OpenRouter lists lowercase dot ids; the registry uses dash/mixed-case
// aliases. Normalize so the same model doesn't show twice.
const norm = (id: string) => id.replace(/\./g, "-").toLowerCase()

export function ModelSelect({
  value,
  onChange,
  options,
  available = [],
}: {
  value: string
  onChange: (value: string) => void
  options: ModelOption[]
  available?: ModelOption[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const curated = new Set(options.map((o) => norm(o.value)))
  const extras = available.filter((m) => !curated.has(norm(m.value)))
  // A configured id outside both lists (config/API-set) still needs a row.
  const custom =
    value && !curated.has(norm(value)) && !extras.some((m) => m.value === value)

  const q = query.trim().toLowerCase()
  const matches = (s: string) => s.toLowerCase().includes(q)
  const shownOptions = options.filter((o) => matches(o.label) || matches(o.value))
  const shownExtras = extras.filter((m) => matches(m.label) || matches(m.value))

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const row = (id: string, label: ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => pick(id)}
      className="flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex-1 truncate">{label}</span>
      {norm(id) === norm(value) && <CheckIcon className="size-3.5 shrink-0" />}
    </button>
  )

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverPrimitive.Trigger className="flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs/relaxed whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30 dark:hover:bg-input/50">
        <span className="flex items-center gap-1.5 truncate">
          {options.find((o) => o.value === value)?.label ??
            available.find((m) => m.value === value)?.label ??
            value}
          {options.find((o) => o.value === value)?.recommended && (
            <span className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground">
              Recommended
            </span>
          )}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-(--radix-popover-trigger-width) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models…"
            className="w-full border-b border-border/50 bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-64 overflow-y-auto p-1">
            {custom && matches(value) && row(value, value)}
            {shownOptions.length > 0 && shownExtras.length > 0 && (
              <div className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Suggested
              </div>
            )}
            {shownOptions.map((o) =>
              row(
                o.value,
                <>
                  {o.label}
                  {o.recommended && (
                    <span className="ml-1.5 rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground">
                      Recommended
                    </span>
                  )}
                </>,
              ),
            )}
            {shownExtras.length > 0 && (
              <div className="px-2 pt-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                All available models
              </div>
            )}
            {shownExtras.map((m) => row(m.value, m.label))}
            {!shownOptions.length && !shownExtras.length && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No models match
              </div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
