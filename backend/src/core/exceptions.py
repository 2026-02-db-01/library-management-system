from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    """비즈니스 로직에서 발생하는 모든 커스텀 예외의 기본 클래스"""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, code: str = "NOT_FOUND", message: str = "요청한 리소스를 찾을 수 없습니다.") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, code=code, message=message)


class ConflictException(AppException):
    def __init__(self, code: str = "CONFLICT", message: str = "현재 상태와 충돌하여 처리할 수 없습니다.") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, code=code, message=message)


class UnauthorizedException(AppException):
    def __init__(self, code: str = "UNAUTHORIZED", message: str = "인증 정보가 유효하지 않습니다.") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, code=code, message=message)


class ForbiddenException(AppException):
    def __init__(self, code: str = "FORBIDDEN", message: str = "해당 작업을 수행할 권한이 없습니다.") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, code=code, message=message)


def register_exception_handlers(app: FastAPI) -> None:
    """FastAPI 앱에 전역 커스텀 예외 핸들러를 등록합니다."""

    @app.exception_handler(AppException)
    def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.code,
                "message": exc.message,
            },
        )