from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.routes import imports
from app.routes.transactions import router as transactions_router
from app.routes.summary import router as summary_router
from app.routes.dev import router as dev_router
from app.routes.categories import router as categories_router

from app.routes import ai

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)


app = FastAPI(title="Velora AI API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://velora-ai.vercel.app",  # URL exata do seu frontend em produção
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    try:
        print("🚀 Starting Velora API...")

        create_tables()

        print("✅ Tables created successfully")

    except Exception as e:
        print("❌ ERROR ON STARTUP:", str(e))
        raise e


@app.get("/")
def read_root():
    return {"message": "Velora AI API is running"}


app.include_router(health_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(summary_router, prefix="/api")
app.include_router(dev_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(ai.router, prefix="/api")