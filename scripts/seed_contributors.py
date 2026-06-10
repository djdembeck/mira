"""Seed realistic contributor analytics data so the Contributors UI has
something to show without a live GitHub backfill.

Writes to the SAME AppDatabase the dashboard server reads (MIRA_INDEX_DIR/_app.db
or DATABASE_URL), plus per-repo IndexStores for the review-quality panel.

Deterministic (fixed seed) and idempotent — re-running refreshes the same rows
rather than piling up duplicates, thanks to the stable external_key scheme.

Usage:
    .venv/bin/python scripts/seed_contributors.py
"""

from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from mira.dashboard.db import AppDatabase
from mira.index.store import IndexStore

random.seed(42)

INDEX_DIR = os.environ.get("MIRA_INDEX_DIR", "./data/indexes")
DB_URL = os.environ.get("DATABASE_URL", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

OWNER = "acme-corp"
REPOS = ["payments-service", "web-app", "mobile-client", "infra"]

# (login, display name, activity weight) — weight scales how much they did.
CONTRIBUTORS = [
    ("amaya-rao", "Amaya Rao", 1.6),
    ("jonas-k", "Jonas Kessler", 1.4),
    ("li-wei", "Li Wei", 1.2),
    ("priya-nair", "Priya Nair", 1.1),
    ("marco-bianchi", "Marco Bianchi", 1.0),
    ("sara-osei", "Sara Osei", 0.9),
    ("tomasz-w", "Tomasz Wójcik", 0.8),
    ("hana-sato", "Hana Sato", 0.7),
    ("diego-mendez", "Diego Méndez", 0.6),
    ("fatima-z", "Fatima Zahra", 0.5),
    ("noah-bergstrom", "Noah Bergström", 0.4),
    ("dependabot[bot]", "Dependabot", 1.0),
]

CATEGORIES = ["bug", "security", "performance", "style", "testing"]


def _day_epoch() -> float:
    """A weekday-biased, recency-biased timestamp within the last year."""
    days_ago = int(random.triangular(0, 364, 45))  # mode ~45 days ago
    d = datetime.now(timezone.utc) - timedelta(days=days_ago)
    if d.weekday() >= 5 and random.random() < 0.75:  # mostly skip weekends
        d -= timedelta(days=2)
    d = d.replace(hour=random.randint(8, 19), minute=random.randint(0, 59))
    return d.timestamp()


def seed() -> None:
    os.makedirs(INDEX_DIR, exist_ok=True)
    db = AppDatabase(url=DB_URL, admin_password=ADMIN_PASSWORD)

    # Register repos so they appear in the list + power the review-quality fan-out.
    for repo in REPOS:
        db.register_repo(OWNER, repo, installation_id=1)
        db.set_repo_status(OWNER, repo, "ready", files_indexed=random.randint(80, 400),
                           bump_last_indexed=True)

    stores = {repo: IndexStore.open(OWNER, repo) for repo in REPOS}
    totals = {"commits": 0, "prs": 0, "merges": 0, "reviews": 0}

    for login, display, weight in CONTRIBUTORS:
        is_bot = login.endswith("[bot]")
        n_commits = 0 if is_bot else int(random.uniform(60, 320) * weight)
        n_prs = int(random.uniform(8, 45) * weight)
        n_reviews = 0 if is_bot else int(random.uniform(5, 40) * weight)
        avatar = "" if is_bot else f"https://github.com/{login}.png"

        # Commits
        for i in range(n_commits):
            repo = random.choice(REPOS)
            db.record_contribution_for_login(
                "github", login, OWNER, repo, "commit", f"commit:{login}-{i}",
                event_at=_day_epoch(), is_bot=is_bot, avatar_url=avatar,
                display_name=display, title="chore: update",
            )
            totals["commits"] += 1

        # PRs (opened + some merged), plus review-quality rows for merged ones
        for i in range(n_prs):
            repo = random.choice(REPOS)
            opened_at = _day_epoch()
            adds = random.randint(5, 600)
            dels = random.randint(0, 300)
            db.record_contribution_for_login(
                "github", login, OWNER, repo, "pr_opened", f"pr:{login}-{i}",
                event_at=opened_at, is_bot=is_bot, avatar_url=avatar,
                display_name=display, pr_number=i, title="feat: a change",
                additions=adds, deletions=dels, changed_files=random.randint(1, 25),
            )
            totals["prs"] += 1
            if random.random() < 0.72:
                db.record_contribution_for_login(
                    "github", login, OWNER, repo, "pr_merged", f"prm:{login}-{i}",
                    event_at=opened_at + random.randint(3600, 5 * 86400),
                    is_bot=is_bot, avatar_url=avatar, display_name=display,
                    pr_number=i, title="feat: a change", merged=True,
                    additions=adds, deletions=dels,
                )
                totals["merges"] += 1
                # Review-quality signal: Mira's review of this author's PR.
                store = stores[repo]
                blockers = random.choices([0, 0, 1, 2], weights=[5, 4, 2, 1])[0]
                warnings = random.choices([0, 1, 2, 3], weights=[3, 4, 3, 1])[0]
                store.record_review(
                    pr_number=i, pr_title="feat: a change",
                    pr_url=f"https://github.com/{OWNER}/{repo}/pull/{i}",
                    comments_posted=blockers + warnings, blockers=blockers,
                    warnings=warnings, suggestions=random.randint(0, 3),
                    files_reviewed=random.randint(1, 20), lines_changed=adds + dels,
                    categories=",".join(random.sample(CATEGORIES, k=random.randint(0, 2))),
                    author=login,
                )
                for _ in range(blockers + warnings):
                    store.record_feedback(
                        pr_number=i,
                        pr_url=f"https://github.com/{OWNER}/{repo}/pull/{i}",
                        comment_path="src/x.py", comment_line=random.randint(1, 200),
                        comment_category=random.choice(CATEGORIES),
                        comment_severity=random.choice(["blocker", "warning"]),
                        comment_title="potential issue",
                        signal=random.choices(["accepted", "rejected"], weights=[3, 1])[0],
                        actor="maintainer", pr_author=login,
                    )

        # Reviews this person gave on others' PRs
        for i in range(n_reviews):
            repo = random.choice(REPOS)
            db.record_contribution_for_login(
                "github", login, OWNER, repo, "review", f"review:{login}-{i}",
                event_at=_day_epoch(), is_bot=is_bot, avatar_url=avatar,
                display_name=display, pr_number=i, title="review",
            )
            totals["reviews"] += 1

    for store in stores.values():
        store.close()

    print(f"Seeded contributors into {DB_URL or os.path.join(INDEX_DIR, '_app.db')}")
    print(
        f"  {len(CONTRIBUTORS)} contributors across {len(REPOS)} repos — "
        f"{totals['commits']} commits, {totals['prs']} PRs "
        f"({totals['merges']} merged), {totals['reviews']} reviews"
    )
    print("Start the app (scripts/start_local.sh) and open the Contributors page.")


if __name__ == "__main__":
    seed()
