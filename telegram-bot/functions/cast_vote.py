"""Authenticated callable endpoint for web citizen-report votes."""

from __future__ import annotations

import logging
import uuid

from firebase_functions import https_fn

from services.voting_service import VoteError, cast_vote

logger = logging.getLogger(__name__)


@https_fn.on_call(region="europe-west1")
def castWebVote(request: https_fn.CallableRequest) -> dict:
    """Validate the signed-in voter and record their vote via the Admin SDK."""
    data = request.data
    if request.auth is None or not request.auth.uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="A fost pornită sesiunea de vot. Încearcă din nou.",
        )
    if not isinstance(data, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Datele votului sunt invalide.",
        )

    event_id = data.get("eventId")
    vote = data.get("vote")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    uid = request.auth.uid
    legacy_device_id = data.get("legacyDeviceId")
    try:
        legacy_device_id = str(uuid.UUID(legacy_device_id)) if isinstance(legacy_device_id, str) else None
    except ValueError:
        legacy_device_id = None
    if (
        not isinstance(event_id, str)
        or not event_id
        or "/" in event_id
        or vote not in {"yes", "no"}
        or isinstance(latitude, bool)
        or not isinstance(latitude, (int, float))
        or isinstance(longitude, bool)
        or not isinstance(longitude, (int, float))
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Datele votului sunt invalide.",
        )

    try:
        result = cast_vote(
            event_id=event_id,
            voter_uid=uid,
            vote=vote,
            source="web",
            legacy_device_id=legacy_device_id,
            latitude=float(latitude),
            longitude=float(longitude),
        )
    except VoteError as error:
        messages = {
            "event_missing": (https_fn.FunctionsErrorCode.NOT_FOUND, "Raportarea nu mai există."),
            "official_event": (https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Anunțurile oficiale nu pot fi votate."),
            "closed": (https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Raportarea este închisă sau a expirat."),
            "not_started": (https_fn.FunctionsErrorCode.FAILED_PRECONDITION, "Raportarea planificată nu a început."),
            "own_event": (https_fn.FunctionsErrorCode.PERMISSION_DENIED, "Nu poți vota propria raportare."),
            "outside_radius": (https_fn.FunctionsErrorCode.PERMISSION_DENIED, "Trebuie să fii la cel mult 1 km de raportare."),
            "already_voted": (https_fn.FunctionsErrorCode.ALREADY_EXISTS, "Ai votat deja această raportare."),
        }
        code, message = messages.get(str(error), (https_fn.FunctionsErrorCode.INTERNAL, "Votul nu a putut fi înregistrat."))
        raise https_fn.HttpsError(code=code, message=message) from error
    except Exception as error:
        logger.exception("Could not record web vote for event %s", event_id)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Votul nu a putut fi înregistrat.",
        ) from error

    return {
        "confirmations": result.confirmations,
        "denials": result.denials,
        "status": result.status,
    }
