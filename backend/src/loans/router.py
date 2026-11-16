# backend/src/users/router.py (books/router.py, loans/router.py도 동일하게 tag만 변경)
from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
def ping():
    return {"domain": "users", "status": "ok"}