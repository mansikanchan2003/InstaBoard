from fastapi import APIRouter, Depends

from app.api.deps import require_auth
from app.api.routes import auth, core, engagement

api_router = APIRouter()

# Public + self-protecting auth routes (login, invitation acceptance, /auth/me …).
api_router.include_router(auth.router)
api_router.include_router(auth.platform)

# Every workspace route requires a valid session. Mounting the dependency here (not per route) means a
# newly added route cannot accidentally be served anonymously; per-route ``require(...)`` adds role checks.
for router in [*core.routers, *engagement.routers]:
    api_router.include_router(router, dependencies=[Depends(require_auth)])
