from fastapi.testclient import TestClient

from src.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_password_hashing_and_verification() -> None:
    raw_password = "library_secret_password_123"
    hashed = hash_password(raw_password)

    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_jwt_token_lifecycle() -> None:
    token = create_access_token(subject=42, extra_claims={"role": "LIBRARIAN"})
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"
    assert payload["role"] == "LIBRARIAN"