import { ArrowDown, ArrowUp, ChevronsUpDown, GitPullRequest, RefreshCw, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router"

import { BarGauge } from "@/components/dashboard/bar-gauge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/lib/auth"
import { api, type ContributorListItem } from "@/lib/api"
import { useAsync } from "@/lib/hooks"

type SortKey = "login" | "commits" | "prs_opened" | "reviews" | "repos_touched" | "last_active"
type SortDir = "asc" | "desc"

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === column
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          active ? "text-foreground" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "" : "opacity-50"}`} />
      </button>
    </TableHead>
  )
}

function relativeTime(epoch: number | null): string {
  if (!epoch) return "—"
  const diff = Date.now() - epoch * 1000
  if (diff < 0) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function ContributorsPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("commits")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Fetch once; sorting is done client-side off the column headers.
  const { data, loading, error } = useAsync(() => api.listContributors(), [])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "login" ? "asc" : "desc")
    }
  }

  const rows = useMemo(() => {
    const filtered = (data ?? []).filter((c) =>
      `${c.login} ${c.display_name}`.toLowerCase().includes(search.toLowerCase()),
    )
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === "login") return dir * a.login.localeCompare(b.login)
      const av = (a[sortKey] ?? -Infinity) as number
      const bv = (b[sortKey] ?? -Infinity) as number
      return dir * (av - bv)
    })
  }, [data, search, sortKey, sortDir])

  const maxCommits = useMemo(
    () => Math.max(1, ...(data ?? []).map((c) => c.commits)),
    [data],
  )

  const onRefresh = async () => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await api.refreshContributors()
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Refresh failed")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contributors</h1>
          <p className="text-sm text-muted-foreground">
            Who contributes across your repositories, and how much
          </p>
        </div>
        {user?.is_admin && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh from GitHub
          </Button>
        )}
      </div>

      {refreshError && <p className="text-sm text-destructive">{refreshError}</p>}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contributors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? <Skeleton className="h-6 w-32" /> : `${rows.length} contributors`}
          </CardTitle>
          <CardDescription>Click a column to sort, or a row to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="ml-auto h-4 w-48" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {(
                    [
                      ["Contributor", "login", "left"],
                      ["Commits", "commits", "right"],
                      ["PRs", "prs_opened", "right"],
                      ["Reviews", "reviews", "right"],
                      ["Last active", "last_active", "right"],
                    ] as [string, SortKey, "left" | "right"][]
                  ).map(([label, column, align]) => (
                    <SortHeader
                      key={column}
                      label={label}
                      column={column}
                      align={align}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c: ContributorListItem) => {
                  const initials = c.login.slice(0, 2).toUpperCase()
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          to={`/contributors/${encodeURIComponent(c.login)}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-8 w-8">
                            {c.avatar_url && <AvatarImage src={c.avatar_url} alt={c.login} />}
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium leading-none">{c.login}</p>
                            {c.display_name && (
                              <p className="text-xs text-muted-foreground">{c.display_name}</p>
                            )}
                          </div>
                          {c.is_bot && (
                            <Badge variant="outline" className="ml-1">
                              bot
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <span className="tabular-nums">{c.commits.toLocaleString()}</span>
                          <BarGauge
                            value={c.commits}
                            max={maxCommits}
                            label={`${c.commits.toLocaleString()} commits`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <GitPullRequest className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.prs_merged.toLocaleString()}/{c.prs_opened.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.reviews.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {relativeTime(c.last_active)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No contributor activity yet. Once Mira reviews PRs (or you run a backfill), people
              will appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
