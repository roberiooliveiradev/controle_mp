# app/api/schemas/_datetime_serializer.py
from datetime import datetime

def serialize_dt(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.isoformat()
    return dt.isoformat()
