#!/usr/bin/env python3
"""Provider-neutral subscription normalization and Premium-access projection."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

NORMALIZED_STATES = frozenset({
    "trialing", "active", "grace", "past_due", "canceled", "unpaid",
    "expired", "refunded", "disputed", "revoked",
})

DEFAULT_PROVIDER_STATUS_MAP: Mapping[str, str] = {
    "trialing": "trialing",
    "active": "active",
    "past_due": "past_due",
    "canceled": "canceled",
    "cancelled": "canceled",
    "unpaid": "unpaid",
    "incomplete": "unpaid",
    "incomplete_expired": "expired",
    "paused": "revoked",
    "refunded": "refunded",
    "disputed": "disputed",
    "revoked": "revoked",
}

@dataclass(frozen=True)
class SubscriptionSnapshot:
    status: str
    current_period_end: datetime | None = None
    grace_until: datetime | None = None
    cancel_at_period_end: bool = False
    override_grants_access: bool = False
    override_expires_at: datetime | None = None

@dataclass(frozen=True)
class AccessProjection:
    grants_premium: bool
    reason: str
    effective_until: datetime | None


def normalize_provider_status(status: str, mapping: Mapping[str, str] = DEFAULT_PROVIDER_STATUS_MAP) -> str:
    key = status.strip().lower()
    normalized = mapping.get(key)
    if normalized not in NORMALIZED_STATES:
        raise ValueError(f"Unsupported provider subscription status: {status!r}")
    return normalized


def project_premium_access(snapshot: SubscriptionSnapshot, now: datetime | None = None) -> AccessProjection:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if snapshot.status not in NORMALIZED_STATES:
        raise ValueError(f"Unknown normalized state: {snapshot.status}")

    if snapshot.override_grants_access and (
        snapshot.override_expires_at is None or snapshot.override_expires_at > now
    ):
        return AccessProjection(True, "administrative_override", snapshot.override_expires_at)

    if snapshot.status in {"trialing", "active"}:
        return AccessProjection(True, snapshot.status, snapshot.current_period_end)

    if snapshot.status in {"grace", "past_due"} and snapshot.grace_until and snapshot.grace_until > now:
        return AccessProjection(True, "payment_grace", snapshot.grace_until)

    if snapshot.status == "canceled" and snapshot.current_period_end and snapshot.current_period_end > now:
        return AccessProjection(True, "paid_through_cancellation", snapshot.current_period_end)

    return AccessProjection(False, snapshot.status, None)


def event_is_newer(*, incoming_created_at: datetime, stored_created_at: datetime | None,
                   incoming_object_version: int | None = None,
                   stored_object_version: int | None = None) -> bool:
    """Return whether an event may update current state; duplicate IDs are handled separately."""
    if incoming_created_at.tzinfo is None:
        raise ValueError("incoming_created_at must be timezone-aware")
    if stored_created_at is None:
        return True
    if incoming_object_version is not None and stored_object_version is not None:
        if incoming_object_version != stored_object_version:
            return incoming_object_version > stored_object_version
    return incoming_created_at >= stored_created_at
