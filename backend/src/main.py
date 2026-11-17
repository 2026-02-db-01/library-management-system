from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.books.router import router as books_router
from src.core.config import settings
from src.core.exceptions import register_exception_handlers
from src.core.state import router as state_router
from src.loans.router import router as loans_router
from src.users.router import auth_router
from src.users.router import router as users_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Access-Token"],
)

app.include_router(auth_router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Auth"])
app.include_router(users_router, prefix=f"{settings.API_V1_PREFIX}/users", tags=["Users"])
app.include_router(books_router, prefix=f"{settings.API_V1_PREFIX}/books", tags=["Books"])
app.include_router(loans_router, prefix=f"{settings.API_V1_PREFIX}/loans", tags=["Loans"])
app.include_router(state_router, prefix=f"{settings.API_V1_PREFIX}/library", tags=["Library"])


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy"}