from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.database import get_db
from src.core.security import create_access_token
from src.users import service
from src.users.dependencies import (
    ACCESS_COOKIE_NAME,
    AdminUser,
    CurrentUser,
    LibrarianUser,
)
from src.users.schemas import (
    AuthenticatedUserResponse,
    LibraryUserResponse,
    LoginRequest,
    ProfileUpdateRequest,
    SignupRequest,
    StaffAccountHistoryResponse,
    StaffCreateRequest,
    StaffStatusUpdateRequest,
    UserActionResponse,
)

auth_router = APIRouter()
router = APIRouter()


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    service.signup_member(db, payload)


@auth_router.post("/login", response_model=AuthenticatedUserResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> AuthenticatedUserResponse:
    user = service.authenticate_user(db, payload)
    access_token = create_access_token(
        subject=user.user_id,
        extra_claims={"role": user.role},
    )

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=not settings.DEBUG,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return AuthenticatedUserResponse.model_validate(user)


@auth_router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(current_user: CurrentUser) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse.model_validate(current_user)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/", secure=not settings.DEBUG, httponly=True, samesite="lax")


@router.patch("/me", response_model=UserActionResponse)
def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> UserActionResponse:
    return service.update_own_profile(db, current_user, payload)


@router.delete("/me", response_model=UserActionResponse)
def withdraw_my_account(
    current_user: CurrentUser,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> UserActionResponse:
    result = service.withdraw_member_account(db, current_user)
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/", secure=not settings.DEBUG, httponly=True, samesite="lax")
    return result


@router.get("", response_model=list[LibraryUserResponse])
def get_users(
    _: LibrarianUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[LibraryUserResponse]:
    users = service.list_all_users(db)
    return [LibraryUserResponse.model_validate(u) for u in users if u.role == "MEMBER"]


@router.post("/staff", response_model=UserActionResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> UserActionResponse:
    return service.create_staff_account(db, payload, admin.user_id)


@router.patch("/staff/{user_id}/status", response_model=UserActionResponse)
def toggle_staff_status(
    user_id: int,
    payload: StaffStatusUpdateRequest,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> UserActionResponse:
    return service.toggle_staff_account_status(db, user_id, payload, admin.user_id)


@router.get("/staff/history", response_model=list[StaffAccountHistoryResponse])
def get_staff_history(
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[StaffAccountHistoryResponse]:
    histories = service.list_staff_histories(db)
    return [StaffAccountHistoryResponse.model_validate(h) for h in histories]