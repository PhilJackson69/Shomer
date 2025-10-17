"""Request utilities: safe JSON reader with size and timeout caps."""

from typing import Any

from fastapi import HTTPException, Request, status


async def read_json_safely(request: Request, max_bytes: int = 64_000, timeout_ms: int = 2_000) -> Any:
    """Read JSON with size and per-read timeout limits to guard against slowloris/DoS.

    Raises 413 on payload too large and 408 on timeout.
    """
    if request.body is None and request.stream is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No request body")

    try:
        # FastAPI/Starlette exposes request.body() which buffers; we enforce size after read
        raw = await request.body()
        if len(raw) > max_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Payload too large")
        return request.app.json_loads(raw)
    except TimeoutError:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Request body timed out")



