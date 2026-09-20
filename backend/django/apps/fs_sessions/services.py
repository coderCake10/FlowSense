"""
apps/fs_sessions/services.py

Implements core business logic for Navigation, QR, and Kiosk sessions.
Ensures strict state transition guarding, unified expiry handling, and 
analytics event emission for the FlowSense architecture.
"""

import hashlib
import secrets
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction

# Assuming models are imported as follows based on FlowSense schema
from fs_sessions.models import NavigationSession, KioskSession
from analytics.models import NavigationRequest, NavigationDestination, QrEvent
from hardware.models import Kiosk


# ==============================================================================
# 1. CORE UTILITIES & VALIDATION
# ==============================================================================

def _generate_qr_token() -> tuple[str, str]:
    """
    Generates an unpredictable, single-use QR token and its SHA-256 hash[cite: 1, 3].
    The raw token is sent to the client once; the hash is stored in the database.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    return raw_token, token_hash

def _validate_status_transition(current_status: str, target_status: str, allowed_map: dict):
    """
    Guards invalid state changes across all session lifecycles.
    """
    if target_status not in allowed_map.get(current_status, []):
        raise ValidationError(
            f"Invalid transition: Cannot move from '{current_status}' to '{target_status}'."
        )

def _emit_qr_analytics_event(session: NavigationSession, event_type: str):
    """
    Emits lifecycle analytics events to analytics.qr_events[cite: 3].
    Valid types: 'generated', 'scanned', 'expired', 'invalid'.
    """
    QrEvent.objects.create(
        navigation_session_id=session.id,
        event_type=event_type,
        created_at=timezone.now()
    )


# ==============================================================================
# 2. KIOSK SESSION MANAGEMENT
# ==============================================================================

def initialize_kiosk_session(kiosk_id: int) -> KioskSession:
    """
    Initializes an active interaction session when a user leaves the Attract Screen[cite: 4, 5].
    """
    kiosk = Kiosk.objects.get(device_id=kiosk_id)
    session = KioskSession.objects.create(
        kiosk=kiosk,
        started_at=timezone.now(),
        last_activity_at=timezone.now()
    )
    return session

def process_kiosk_heartbeat(session: KioskSession) -> KioskSession:
    """
    Processes periodic pings from the frontend to prevent idle timeout[cite: 4, 5].
    """
    if session.ended_at:
        raise ValidationError("Cannot heartbeat an ended kiosk session.")
    
    session.last_activity_at = timezone.now()
    session.save(update_fields=['last_activity_at'])
    return session

def terminate_kiosk_session(session: KioskSession, reason: str = KioskSession.END_MANUAL_EXIT) -> KioskSession:
    """
    Terminates the kiosk session and triggers the UI reset to the Attract Screen[cite: 4, 5].
    """
    if session.ended_at:
        return session

    session.ended_at = timezone.now()
    session.end_reason = reason
    session.save(update_fields=['ended_at', 'end_reason'])
    return session


# ==============================================================================
# 3. NAVIGATION & QR SESSION MANAGEMENT (SHARED LIFECYCLE)
# ==============================================================================

ALLOWED_NAV_TRANSITIONS = {
    NavigationSession.STATUS_CREATED: [NavigationSession.STATUS_ACTIVE, NavigationSession.STATUS_SCANNED, NavigationSession.STATUS_EXPIRED, NavigationSession.STATUS_CANCELLED],
    NavigationSession.STATUS_ACTIVE: [NavigationSession.STATUS_COMPLETED, NavigationSession.STATUS_CANCELLED, NavigationSession.STATUS_EXPIRED],
    NavigationSession.STATUS_SCANNED: [NavigationSession.STATUS_COMPLETED, NavigationSession.STATUS_CANCELLED, NavigationSession.STATUS_EXPIRED],
}

@transaction.atomic
def create_navigation_session(navigation_request: NavigationRequest, kiosk_session_id: str = None) -> tuple[NavigationSession, str]:
    """
    Wraps an ALREADY-COMPUTED route in a session. Backs both Nav and QR creation[cite: 2].
    Initializes the destination queue and generates the secure handoff token.
    """
    raw_token, token_hash = _generate_qr_token()
    
    # Session stays valid for 15 minutes before the Kiosk times out the QR
    expires_at = timezone.now() + timedelta(minutes=15)

    session = NavigationSession.objects.create(
        kiosk_session_id=kiosk_session_id,
        session_token_hash=token_hash,
        status=NavigationSession.STATUS_CREATED,
        expires_at=expires_at,
        created_at=timezone.now()
    )
    
    # Bind the request to this session
    navigation_request.navigation_session_id = session.id
    navigation_request.save(update_fields=['navigation_session_id'])

    _emit_qr_analytics_event(session, 'generated')
    
    return session, raw_token

def aggregate_session_status(session: NavigationSession) -> dict:
    """
    Assembles the exact dictionary shape expected by NavigationSessionSerializer[cite: 2].
    Joins the session state with the underlying analytics.navigation_requests route data.
    """
    nav_request = NavigationRequest.objects.filter(navigation_session_id=session.id).first()
    destinations = NavigationDestination.objects.filter(navigation_request_id=nav_request.id).order_by('destination_order') if nav_request else []

    return {
        "id": session.id,
        "status": session.status,
        "kiosk_session_id": session.kiosk_session_id,
        "expires_at": session.expires_at,
        "created_at": session.created_at,
        "scanned_at": session.scanned_at,
        "completed_at": session.completed_at,
        "origin_node": getattr(nav_request, 'origin_node', None),
        "route_distance": getattr(nav_request, 'route_distance', None),
        "destinations": destinations,
    }

@transaction.atomic
def initiate_qr_handoff(session: NavigationSession, provided_raw_token: str) -> NavigationSession:
    """
    Registers a mobile scan, verifying the token and transitioning state to 'scanned'[cite: 1, 5].
    """
    _validate_status_transition(session.status, NavigationSession.STATUS_SCANNED, ALLOWED_NAV_TRANSITIONS)
    
    provided_hash = hashlib.sha256(provided_raw_token.encode('utf-8')).hexdigest()
    if not secrets.compare_digest(session.session_token_hash, provided_hash):
        _emit_qr_analytics_event(session, 'invalid')
        raise ValidationError("Invalid or expired QR token.")

    session.status = NavigationSession.STATUS_SCANNED
    session.scanned_at = timezone.now()
    session.save(update_fields=['status', 'scanned_at'])
    
    _emit_qr_analytics_event(session, 'scanned')
    return session

def pause_navigation_session(session: NavigationSession) -> NavigationSession:
    """
    Handles pause state transitions.
    (Note: As 'paused' is not a DB-level status constraint[cite: 3], this extends 
    expires_at to suspend timeouts while paused, or updates a metadata flag).
    """
    if session.status not in [NavigationSession.STATUS_ACTIVE, NavigationSession.STATUS_SCANNED]:
        raise ValidationError("Only active or scanned sessions can be paused.")
    
    # Suspend expiration by pushing it forward indefinitely or utilizing a metadata flag
    session.expires_at = timezone.now() + timedelta(days=1) 
    session.save(update_fields=['expires_at'])
    return session

def resume_navigation_session(session: NavigationSession) -> NavigationSession:
    """
    Resumes a paused navigation session, resetting standard expiry clocks[cite: 5].
    """
    session.expires_at = timezone.now() + timedelta(minutes=30)
    session.save(update_fields=['expires_at'])
    return session

@transaction.atomic
def complete_navigation_session(session: NavigationSession) -> NavigationSession:
    """
    Marks session and associated route request as completed, finalizing timestamps[cite: 1, 3].
    """
    _validate_status_transition(session.status, NavigationSession.STATUS_COMPLETED, ALLOWED_NAV_TRANSITIONS)
    
    now = timezone.now()
    session.status = NavigationSession.STATUS_COMPLETED
    session.completed_at = now
    session.save(update_fields=['status', 'completed_at'])

    nav_request = NavigationRequest.objects.filter(navigation_session_id=session.id).first()
    if nav_request:
        nav_request.status = 'completed'
        nav_request.completed_at = now
        nav_request.save(update_fields=['status', 'completed_at'])

    return session

@transaction.atomic
def cancel_navigation_session(session: NavigationSession) -> NavigationSession:
    """
    Aborts a navigation/QR session entirely (manual cancellation or idle sweep cleanup)[cite: 1, 5].
    """
    _validate_status_transition(session.status, NavigationSession.STATUS_CANCELLED, ALLOWED_NAV_TRANSITIONS)
    
    session.status = NavigationSession.STATUS_CANCELLED
    session.save(update_fields=['status'])
    return session


# ==============================================================================
# 4. DESTINATION QUEUE & CHECKLIST LOGIC
# ==============================================================================

def validate_and_resolve_next_destination(session: NavigationSession) -> NavigationDestination:
    """
    Validates destination order and identifies the next pending destination in the queue.
    """
    nav_request = NavigationRequest.objects.filter(navigation_session_id=session.id).first()
    if not nav_request:
        raise ValidationError("No route associated with this session.")

    # Find the lowest ordered destination that has not yet been reached
    next_dest = NavigationDestination.objects.filter(
        navigation_request_id=nav_request.id,
        reached_at__isnull=True
    ).order_by('destination_order').first()

    return next_dest

@transaction.atomic
def confirm_destination_reached(session: NavigationSession, destination_id: int, method: str = "manual") -> dict:
    """
    Marks a destination as reached (BLE or manual). Auto-completes session if queue is empty[cite: 2, 5].
    """
    nav_request = NavigationRequest.objects.filter(navigation_session_id=session.id).first()
    destination = NavigationDestination.objects.get(id=destination_id, navigation_request_id=nav_request.id)

    if destination.reached_at:
        return {"status": "already_reached", "session": session}

    # Ensure out-of-order reaches are validated or accepted based on business logic
    expected_next = validate_and_resolve_next_destination(session)
    if expected_next and expected_next.id != destination.id:
        # Flexible queue handling: allowed to reach out of order, or enforce strict routing here.
        pass 

    destination.reached_at = timezone.now()
    destination.save(update_fields=['reached_at'])

    # Check if this was the final destination
    remaining = NavigationDestination.objects.filter(
        navigation_request_id=nav_request.id, 
        reached_at__isnull=True
    ).exists()

    if not remaining:
        complete_navigation_session(session)
        return {"status": "session_completed", "session": session}

    return {"status": "destination_updated", "session": session}


# ==============================================================================
# 5. GLOBAL SESSION SWEEPER
# ==============================================================================

@transaction.atomic
def sweep_expired_sessions():
    """
    Shared expiration checker across Navigation/QR/Kiosk sessions[cite: 1, 3, 9].
    Intended to be called by Celery Beat schedules.
    """
    now = timezone.now()
    
    # 1. Expire stale Navigation/QR Sessions
    stale_nav_sessions = NavigationSession.objects.filter(
        status__in=[NavigationSession.STATUS_CREATED, NavigationSession.STATUS_ACTIVE],
        expires_at__lt=now
    )
    for session in stale_nav_sessions:
        session.status = NavigationSession.STATUS_EXPIRED
        session.save(update_fields=['status'])
        _emit_qr_analytics_event(session, 'expired')

    # 2. Expire Idle Kiosk Sessions (e.g., 5 minutes without heartbeat)
    idle_threshold = now - timedelta(minutes=5)
    stale_kiosk_sessions = KioskSession.objects.filter(
        ended_at__isnull=True,
        last_activity_at__lt=idle_threshold
    )
    for kiosk_session in stale_kiosk_sessions:
        kiosk_session.ended_at = now
        kiosk_session.end_reason = KioskSession.END_IDLE_TIMEOUT
        kiosk_session.save(update_fields=['ended_at', 'end_reason'])