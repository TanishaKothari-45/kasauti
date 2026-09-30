from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from clinic_api.api import health
from clinic_api.config import settings

app = FastAPI(title="Clinic API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health.router)
