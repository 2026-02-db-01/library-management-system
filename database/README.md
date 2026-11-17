# database — PostgreSQL 16 (로컬 실행 안내)

백엔드 개발용으로 **각자 로컬에 DB 컨테이너를 띄워서** 연결을 확인하는 방법이다.
스키마 기준 문서는 위키 `03-03 물리적 데이터 모델`이고, 이 폴더의 `schema.sql` 이 그 구현이다.

## 1. 실행

필요한 것: Docker Desktop (Compose 포함)

```bash
cd database
cp .env.example .env      # 비밀번호 3개를 아무 값으로 바꾼다 (로컬 전용, 커밋 금지)
docker compose up -d
docker compose ps         # STATUS 가 healthy 면 준비 완료
```

처음 뜰 때 아래 순서로 자동 실행된다 (볼륨이 비어 있을 때 한 번만).

| 순서 | 파일 | 내용 |
|---|---|---|
| 00 | `initdb/00-roles.sh` | DB 계정 3개 생성 + 기본 권한 |
| 10 | `schema.sql` | 테이블 12개, 트리거, 함수, 뷰 |
| 20 | `seed.sql` | 시연·개발용 데이터 (계정 10, 도서 10, 대출 14건) |

- 접속 주소: `127.0.0.1:5433` / DB 이름 `library` (로컬에 이미 있는 PostgreSQL 5432 와 겹치지 않게 5433)
- 처음부터 다시: `docker compose down -v` 후 `docker compose up -d`
  (`-v` 가 데이터 볼륨을 지운다. schema.sql 이 바뀌었으면 이렇게 해야 반영된다)
- 데이터만 seed 상태로 되돌리기: `docker compose exec db psql -U postgres -d library -f /demo/reset_demo.sql`
  (Windows Git Bash 에서는 앞에 `MSYS_NO_PATHCONV=1` 을 붙이거나 PowerShell 에서 실행)

## 2. 백엔드 연결 확인

백엔드는 **`library_app`** 계정으로 접속한다. 비밀번호는 `.env` 의 `LIBRARY_APP_PASSWORD`.

```
postgresql+psycopg://library_app:<LIBRARY_APP_PASSWORD>@127.0.0.1:5433/library
```

연결 확인용 (psycopg 3: `pip install "psycopg[binary]"`):

```python
import psycopg

with psycopg.connect("postgresql://library_app:<비밀번호>@127.0.0.1:5433/library") as conn:
    print(conn.execute(
        "SELECT current_user, count(*) FROM v_book_availability WHERE is_public"
    ).fetchone())
# ('library_app', 8) 이 나오면 정상
```

## 3. 계정과 권한 — 먼저 알아둘 것

| DB 계정 | 용도 | 할 수 있는 것 |
|---|---|---|
| `library_owner` | 모든 테이블·함수의 소유자 | 로그인 불가 |
| `library_app` | 백엔드 API | SELECT / INSERT / UPDATE |
| `library_readonly` | 조회·채점용 | SELECT |

- **`library_app` 은 테이블을 만들거나 바꿀 수 없다.**
  SQLAlchemy `Base.metadata.create_all()`, Alembic 자동 마이그레이션은 권한 오류가 난다.
  ORM 모델은 `schema.sql` 에 맞춰 작성(또는 `sqlacodegen` 으로 생성)하고,
  스키마 변경이 필요하면 DB 담당에게 요청한다.
- **DELETE 권한이 없다** (`book_author` 만 예외). 취소·탈퇴는 행을 지우지 않고 UPDATE 로 처리한다.
  - 대출 취소: `loan.is_cancelled = TRUE, cancelled_at = now()` + `loan_correction_history` INSERT
  - 회원 탈퇴: `loan.member_user_id`, `request_record.actor_user_id` 를 NULL 로 → `app_user` 개인정보 NULL + `WITHDRAWN`
- **이력 테이블은 INSERT 만 된다** (UPDATE 도 불가):
  `loan_renewal`, `staff_account_history`, `book_change_history`, `copy_status_history`, `loan_correction_history`
- PK 는 전부 IDENTITY 다. INSERT 할 때 ID 를 직접 넣지 말고 `RETURNING` 으로 받는다.

## 4. DB 가 막아주는 것 → 에러 처리

규칙 위반은 예외로 돌아온다. **SQLSTATE + 제약 이름**으로 구분하면 된다.
psycopg 3 기준 `e.sqlstate`, `e.diag.constraint_name`
(SQLAlchemy 를 쓰면 `IntegrityError.orig` 가 psycopg 예외).

| SQLSTATE | 제약 이름 예 | 의미 |
|---|---|---|
| 23505 | `uq_loan_valid_unreturned_copy` | 이미 대출 중인 소장본 |
| 23505 | `uq_loan_renewal_loan` | 이미 한 번 연장한 대출 |
| 23505 | `pk_request_record` | 같은 `request_id` 재전송 → 저장된 결과를 돌려준다 |
| 23505 | `uq_app_user_login_id`, `uq_app_user_active_member_contact`, `uq_book_isbn`, `uq_book_copy_code` | 중복 |
| 23514 | `ck_*` | 값 형식·조합 규칙 위반 (예: `ck_app_user_contact_format`) |
| 23514 | `trg_app_user_role_immutable` | 계정 역할 변경 시도 |
| 23514 | `trg_app_user_withdrawal_final` | 탈퇴 계정 되살리기 시도 |
| 23514 | `trg_book_copy_retired_final` | 제적 소장본 상태 되돌리기 시도 |
| 23514 | `trg_loan_new_insert_guard` | 신규 대출을 반납·취소·연장된 상태로 등록 시도 |
| 23503 | `fk_*` | 없는 회원·소장본 등 참조 |
| 22001 | — | 문자열 길이 초과 |
| 42501 | — | 권한 없음 (DELETE, 이력 UPDATE, DDL 등) |

트리거 에러도 23514 + `CONSTRAINT` 이름으로 통일해 두었기 때문에 CHECK 위반과 같은 방식으로 처리하면 된다.

## 5. DB 가 막지 않는 것 → 백엔드가 구현

- 대출 한도 5권
- 연체 중이거나 정지 기간(`borrowing_suspended_until > now()`)인 회원의 대출 거절
- 연장 가능 여부 (연체 아님, 아직 연장 안 함 등 — 1회 제한은 DB 가 `uq_loan_renewal_loan` 으로 한 번 더 막음)
- 반납 시 정지 캐시 갱신:
  `UPDATE app_user SET borrowing_suspended_until = fn_member_suspension_until(:member_id) WHERE user_id = :member_id`
- `request_record` 흐름: 요청 시 `PENDING` INSERT → 처리 후 `COMPLETED`/`FAILED` + `result_code`, `completed_at` UPDATE
- 비밀번호 해시: seed 는 bcrypt (`$2a$`, cost 10). Python `bcrypt.checkpw()` 로 그대로 검증된다.

## 6. 그대로 쓰면 되는 뷰·함수

연체·대출 가능 여부는 테이블에 저장하지 않고 계산한다 (날짜는 한국 시간 기준, 만기일 당일은 연체 아님).

| 이름 | 내용 |
|---|---|
| `v_book_availability` | 도서별 소장본 수, 대출 가능 수, 일반 공개 여부(`is_public`) |
| `v_copy_availability` | 소장본별 대출 가능 여부, 현재 대출 ID·만기일 |
| `v_active_loan_status` | 미반납 대출의 연장 여부, 연체 일수, 연체 여부 |
| `fn_overdue_days(due_date, at)` | 연체 일수 |
| `fn_member_suspension_until(member_id)` | 회원 정지 종료 시각 재계산 |

## 7. 시드 데이터 (테스트용 계정)

로그인 ID: `admin`, `librarian1`~`3`, `member_kim` / `lee` / `park` / `choi` / `jung`
공통 비밀번호와 각 계정의 상황(연체·정지·한도 초과 등)은 `seed.sql` 머리말과 시나리오 주석에 있다.

| 계정 | 상태 |
|---|---|
| `member_lee` | 6일 연체 중 → 대출·연장 거절 대상 |
| `member_park` | 대출 정지 중 (약 8일 남음) |
| `member_choi` | 5권 대출 중 → 한도 초과 |
| `member_kim` | 정상, 연장한 대출 1건 |
| `member_jung` | 대출 기록 없음 → 신규 대출 테스트용 |
| `librarian3` | 비활성 직원 |
