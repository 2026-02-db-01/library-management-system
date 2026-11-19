"""Optional live API checks. Use a dedicated PostgreSQL database seeded with seed.sql."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select

from src.core.database import SessionLocal, get_db
from src.main import app
from src.loans.models import Loan, LoanCorrectionHistory, RequestRecord
from src.users.models import User

BASE = os.getenv("CHAEKDAM_INTEGRATION_URL")
pytestmark = pytest.mark.skipif(not BASE, reason="Requires a dedicated seeded PostgreSQL API")
SEED_PASSWORD = os.getenv("CHAEKDAM_SEED_PASSWORD")


def request(client, method, path, status, **kwargs):
    result = client.request(method, path, **kwargs)
    assert result.status_code == status, (method, path, result.status_code, result.text)
    return result.json() if result.content and result.headers.get("content-type", "").startswith("application/json") else None


def client():
    return httpx.Client(base_url=f"{BASE}/api/v1", timeout=20)


def login(http, name, password=None):
    return request(http, "POST", "/auth/login", 200, json={
        "loginId": name, "password": password or SEED_PASSWORD,
    })


def identity():
    key = uuid4()
    return {
        "loginId": f"qa_{key.hex[:16]}",
        "password": uuid4().hex,
        "fullName": f"QA {key.hex[:8]}",
        "contact": f"019{key.int % 100000000:08d}",
    }


def new_member(http):
    payload = identity()
    request(http, "POST", "/auth/signup", 201, json=payload)
    return login(http, payload["loginId"], payload["password"])


def race(left, right):
    barrier = Barrier(2)
    def invoke(action):
        barrier.wait(timeout=10)
        return action()
    with ThreadPoolExecutor(2) as executor:
        futures = [executor.submit(invoke, action) for action in (left, right)]
        return [future.result().status_code for future in futures]


def test_session_role_privacy_and_staff_policy():
    with client() as member, client() as admin, client() as librarian, client() as staff:
        invalid = {"loginId": "invalid", "password": "private-input-" * 12}
        result = member.post("/auth/login", json=invalid)
        assert result.status_code == 422 and invalid["password"] not in result.text
        request(member, "GET", "/library/state", 401)
        me = new_member(member)
        assert request(member, "GET", "/auth/me", 200)["role"] == "MEMBER"
        assert request(member, "GET", "/loans/me", 200) == []
        assert request(member, "GET", "/library/state", 200)["loans"] == []
        request(member, "POST", "/books", 403, json={"title": "Denied"})
        login(admin, "admin")
        state = request(admin, "GET", "/library/state", 200)
        assert not state["loans"] and not state["corrections"]
        assert state["loanStatistics"]["total"] > 0
        assert next(user for user in state["users"] if user["userId"] == me["userId"])["contact"] is None
        request(admin, "POST", "/loans/checkout", 403, json={"memberUserId": me["userId"], "copyId": 1})
        login(librarian, "librarian1")
        request(librarian, "GET", "/users/staff/history", 403)
        data = {**identity(), "role": "LIBRARIAN"}
        request(admin, "POST", "/users/staff", 422, json={k: v for k, v in data.items() if k != "password"})
        created = request(admin, "POST", "/users/staff", 201, json=data)["user"]
        login(staff, data["loginId"], data["password"])
        request(admin, "PATCH", f"/users/staff/{created['userId']}/status", 200, json={"reason": "QA employee status"})
        request(staff, "GET", "/auth/me", 403)
        request(staff, "POST", "/books", 403, json={"title": "Denied"})
        request(member, "POST", "/auth/logout", 204)
        request(member, "GET", "/auth/me", 401)


def test_loan_limit_copy_conflict_and_request_replay():
    with client() as left, client() as right, client() as first, client() as second:
        login(left, "librarian1")
        login(right, "librarian2")
        member = new_member(first)["userId"]
        other = new_member(second)["userId"]
        book_id = request(left, "GET", "/books", 200)[0]["bookId"]
        copies = [request(left, "POST", f"/books/{book_id}/copies", 201)["copyId"] for _ in range(7)]
        def payload(user, copy):
            return {"memberUserId": user, "copyId": copy, "requestId": str(uuid4())}
        def checkout(http, values):
            return http.post("/loans/checkout", json=values)
        for copy in copies[:4]:
            request(left, "POST", "/loans/checkout", 201, json=payload(member, copy))
        assert sorted(race(
            lambda: checkout(left, payload(member, copies[4])),
            lambda: checkout(right, payload(member, copies[5])),
        )) == [201, 409]
        owned = request(first, "GET", "/loans/me", 200)
        assert len(owned) == 5
        assert request(first, "GET", "/library/state", 200)["loans"]
        assert request(second, "GET", "/loans/me", 200) == []
        remaining = next(copy for copy in copies[4:6] if copy not in {row["copyId"] for row in owned})
        third = new_member(first)["userId"]
        assert sorted(race(
            lambda: checkout(left, payload(third, remaining)),
            lambda: checkout(right, payload(other, remaining)),
        )) == [201, 409]
        retry = payload(third, copies[6])
        winning = request(left, "POST", "/loans/checkout", 201, json=retry)
        assert request(left, "POST", "/loans/checkout", 201, json=retry)["loanId"] == winning["loanId"]
        request(left, "POST", "/loans/checkout", 409, json={**retry, "copyId": copies[5]})
        late = login(second, "member_lee")["userId"]
        response = left.post("/loans/checkout", json=payload(late, copies[6]))
        assert response.status_code == 403 and response.json()["code"] == "OVERDUE_BLOCKED"


def test_catalog_renew_return_correction_and_withdrawal():
    with client() as staff, client() as reader:
        login(staff, "librarian1")
        person = new_member(reader)
        book = request(staff, "POST", "/books", 201, json={
            "title": f"QA Catalog {uuid4().hex[:10]}",
            "authorNames": f"QA Writer {uuid4().hex[:10]}",
            "categoryCode": "DEMO_GENERAL",
        })
        book_path = f"/books/{book['bookId']}"
        request(reader, "GET", book_path, 404)
        update = {"title": f"{book['title']} Updated", "authorIds": [book["authors"][0]["authorId"]],
                  "categoryCode": book["categoryCode"]}
        request(staff, "PUT", book_path, 200, json=update)
        copy = request(staff, "POST", book_path + "/copies", 201)
        assert request(reader, "GET", book_path, 200)["title"] == update["title"]
        checkout = request(staff, "POST", "/loans/checkout", 201, json={
            "memberUserId": person["userId"], "copyId": copy["copyId"],
        })
        loan_id = checkout["loanId"]
        loan_path = f"/loans/{loan_id}"
        request(staff, "PATCH", f"/books/copies/{copy['copyId']}/status", 409,
                json={"status": "RETIRED", "reason": "QA retirement"})
        request(reader, "DELETE", "/users/me", 409)
        renew_id = str(uuid4())
        request(reader, "POST", loan_path + "/renew", 200, json={"requestId": renew_id})
        request(reader, "POST", loan_path + "/renew", 409, json={})
        request(staff, "POST", loan_path + "/return", 200, json={})
        request(staff, "POST", loan_path + "/correct", 400, json={
            "type": "CANCEL_LOAN", "reason": "QA correction", "physicalConfirmed": False,
        })
        request(staff, "POST", loan_path + "/correct", 200, json={
            "type": "UNDO_RETURN", "reason": "QA correction", "physicalConfirmed": True,
        })
        request(staff, "POST", loan_path + "/return", 200, json={})
        with SessionLocal() as db:
            before = db.scalar(select(LoanCorrectionHistory).where(LoanCorrectionHistory.loan_id == loan_id))
            assert before is not None
            snapshot = (before.reason, before.before_values, before.after_values)
        request(reader, "DELETE", "/users/me", 200)
        request(reader, "GET", "/auth/me", 401)
        with SessionLocal() as db:
            user = db.get(User, person["userId"])
            loan = db.get(Loan, loan_id)
            renew = db.get(RequestRecord, renew_id)
            correction = db.scalar(select(LoanCorrectionHistory).where(LoanCorrectionHistory.loan_id == loan_id))
            assert user.account_status == "WITHDRAWN"
            assert (user.login_id, user.password_hash, user.full_name, user.contact) == (None,) * 4
            assert loan.member_user_id is None and loan.returned_at is not None
            assert renew.actor_user_id is None and renew.response_snapshot == {"ok": True}
            assert (correction.reason, correction.before_values, correction.after_values) == snapshot


def test_concurrent_admin_disables_keep_one_active():
    with client() as left, client() as right:
        first = login(left, "admin")["userId"]
        payload = {**identity(), "role": "ADMIN"}
        second = request(left, "POST", "/users/staff", 201, json=payload)["user"]["userId"]
        login(right, payload["loginId"], payload["password"])
        path = "/users/staff/{}/status"
        statuses = race(
            lambda: left.patch(path.format(second), json={"reason": "QA concurrent status A"}),
            lambda: right.patch(path.format(first), json={"reason": "QA concurrent status B"}),
        )
        assert statuses.count(200) == 1 and any(status in (403, 409) for status in statuses)
        with SessionLocal() as db:
            active = list(db.scalars(select(User).where(User.role == "ADMIN", User.account_status == "ACTIVE")))
            assert len(active) == 1
            remaining = active[0].user_id
        winner, target = (left, second) if remaining == first else (right, first)
        request(winner, "PATCH", path.format(target), 200, json={"reason": "QA restore seeded administrator"})
        request(left, "PATCH", path.format(second), 200, json={"reason": "QA restore single seeded administrator"})

def test_audit_constraint_failure_rolls_back_correction_and_withdrawal():
    with client() as staff, client() as reader:
        login(staff, "librarian1")
        payload = identity()
        request(reader, "POST", "/auth/signup", 201, json=payload)
        member = login(reader, payload["loginId"], payload["password"])
        book_id = request(staff, "GET", "/books", 200)[0]["bookId"]
        copy_id = request(staff, "POST", f"/books/{book_id}/copies", 201)["copyId"]
        loan_id = request(staff, "POST", "/loans/checkout", 201, json={
            "memberUserId": member["userId"], "copyId": copy_id,
        })["loanId"]
        request(staff, "POST", f"/loans/{loan_id}/return", 200, json={})

    def force_constraint_failure(db, _context, _instances):
        for row in db.new:
            if isinstance(row, LoanCorrectionHistory):
                row.reason = ""
        for row in db.dirty:
            if isinstance(row, User) and row.account_status == "WITHDRAWN":
                row.contact = "01911112222"

    def failing_db():
        with SessionLocal() as db:
            event.listen(db, "before_flush", force_constraint_failure)
            yield db

    app.dependency_overrides[get_db] = failing_db
    try:
        with TestClient(app, base_url="https://testserver", raise_server_exceptions=False) as injected:
            prefix = "/api/v1"
            request(injected, "POST", prefix + "/auth/login", 200,
                    json={"loginId": "librarian1", "password": SEED_PASSWORD})
            request(injected, "POST", prefix + f"/loans/{loan_id}/correct", 500,
                    json={"type": "UNDO_RETURN", "reason": "QA atomic rollback", "physicalConfirmed": True})
            request(injected, "POST", prefix + "/auth/login", 200,
                    json={"loginId": payload["loginId"], "password": payload["password"]})
            request(injected, "DELETE", prefix + "/users/me", 500)
    finally:
        app.dependency_overrides.pop(get_db, None)

    with SessionLocal() as db:
        loan = db.get(Loan, loan_id)
        user = db.get(User, member["userId"])
        assert loan.returned_at is not None and loan.member_user_id == user.user_id
        assert user.account_status == "ACTIVE" and user.contact == payload["contact"]
        assert db.scalar(select(LoanCorrectionHistory).where(LoanCorrectionHistory.loan_id == loan_id)) is None
