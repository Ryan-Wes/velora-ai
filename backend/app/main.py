from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routes.health import router as health_router
from app.routes.upload import router as upload_router
from app.routes import imports
from app.routes.transactions import router as transactions_router
from app.routes.summary import router as summary_router
from app.routes.dev import router as dev_router


app = FastAPI(title="FinSight AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_tables()


@app.get("/")
def read_root():
    return {"message": "FinSight AI API is running"}


app.include_router(health_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(summary_router, prefix="/api")
app.include_router(dev_router, prefix="/api")