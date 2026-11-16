from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.core.database import Base, engine, get_db
from src.main import app

# 추후 도메인별 models.py 작성 및 테이블 생성 테스트 시 아래 주석을 해제합니다.
# from src.users import models as user_models  # noqa: F401
# from src.books import models as book_models  # noqa: F401
# from src.loans import models as loan_models  # noqa: F401


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None, None, None]:
    """테스트 세션 시작 시 테이블 메타데이터를 준비합니다."""
    # 물리 모델링 반영 후 아래 주석을 해제하면 테스트 실행 시 테이블이 자동 생성됩니다.
    # Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """각 테스트마다 독립적인 트랜잭션과 SAVEPOINT를 열어 종료 시 자동 롤백합니다."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI의 get_db 의존성을 테스트용 롤백 세션으로 교체한 HTTP 클라이언트를 제공합니다."""

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()  