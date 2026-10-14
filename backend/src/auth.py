"""Demo doctor sign-in. Tokens live in memory for this process only."""

from __future__ import annotations

import hashlib
import secrets

DOCTORS = {
    "doctor.mehta": {
        "password": "clinic2026",
        "name": "Dr Mehta",
        "panel": 0,
    },
    "doctor.iyer": {
        "password": "clinic2026",
        "name": "Dr Iyer",
        "panel": 1,
    },
}

TOKENS: dict[str, str] = {}


def panel_for(patient_id: str, demo_patient_id: str) -> int:
    if patient_id == demo_patient_id:
        return 0
    return int(hashlib.sha256(patient_id.encode()).hexdigest(), 16) % 2


def login(username: str, password: str) -> dict:
    doctor = DOCTORS.get(username.strip())
    if doctor is None or doctor["password"] != password:
        raise PermissionError("unknown doctor id or password")
    token = secrets.token_urlsafe(24)
    TOKENS[token] = username
    return {"token": token, "name": doctor["name"], "username": username}


def doctor_from_token(token: str) -> dict:
    username = TOKENS.get(token)
    if username is None:
        raise PermissionError("sign in required")
    doctor = DOCTORS[username]
    return {"username": username, "name": doctor["name"], "panel": doctor["panel"]}
