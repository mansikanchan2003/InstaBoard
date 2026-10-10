from fastapi import APIRouter

from app.api.routes import core, engagement

api_router = APIRouter()
for router in [*core.routers, *engagement.routers]:
    api_router.include_router(router)
