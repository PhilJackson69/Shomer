"""CSRF token endpoint to issue/rotate signed tokens."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.middleware.csrf import CSRFProtectionMiddleware


router = APIRouter()


@router.get("/")
async def get_csrf_token():
    mw = CSRFProtectionMiddleware  # type: ignore
    token = mw._generate_token(mw)  # call instance method style with class (uses no self state)
    resp = JSONResponse({"token": token})
    # Set cookie so client can double-submit
    resp.set_cookie(
        key=mw.CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=True,
        samesite="lax",
        max_age=86400,
    )
    return resp



