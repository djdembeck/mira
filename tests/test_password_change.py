"""Tests for changing/resetting user passwords."""

from __future__ import annotations

from pathlib import Path

import pytest

from mira.dashboard.db import AppDatabase


@pytest.fixture
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AppDatabase:
    monkeypatch.setenv("MIRA_INDEX_DIR", str(tmp_path))
    return AppDatabase(url="", admin_password="admin")


def test_update_password_changes_login(db: AppDatabase) -> None:
    admin = db.authenticate("admin", "admin")
    assert admin is not None

    db.update_password(admin.id, "newpass123")

    # Old password no longer works; new one does.
    assert db.authenticate("admin", "admin") is None
    assert db.authenticate("admin", "newpass123") is not None


def test_update_password_only_affects_target_user(db: AppDatabase) -> None:
    admin = db.authenticate("admin", "admin")
    assert admin is not None
    other = db.create_user("bob", "bobpass", is_admin=False)

    db.update_password(other.id, "changed")

    # Bob's password changed; admin's is untouched.
    assert db.authenticate("bob", "bobpass") is None
    assert db.authenticate("bob", "changed") is not None
    assert db.authenticate("admin", "admin") is not None
