-- 시연 데이터 초기화: 스키마·역할은 그대로 두고 데이터만 seed 직후 상태로 되돌린다.
--
-- 서버에서는 볼륨을 지우는 `docker compose down -v` 를 쓰면 안 되므로 이 파일을 쓴다.
-- 실행 (database/ 폴더에서):
--   docker compose exec db psql -U postgres -d library -f /demo/reset_demo.sql
--   (Windows Git Bash 에서는 /demo 경로가 C:/Program Files/Git/demo 로 바뀌므로
--    앞에 MSYS_NO_PATHCONV=1 을 붙이거나 PowerShell 에서 실행)
--
-- 1) TRUNCATE ... RESTART IDENTITY : 행 삭제 + IDENTITY 시퀀스를 1부터 다시
--    CASCADE 없이 12개 테이블을 한 문장에 모두 적어서, FK 로 얽힌 테이블을 한 번에 비운다.
--    (TRUNCATE 는 테이블 소유자/슈퍼유저만 가능 -> library_app 으로는 실행 불가)
-- 2) seed.sql 다시 실행 : 날짜가 now() 기준이라 "6일 연체" 같은 상태가 다시 맞춰진다.
--
-- seed 가 중간에 실패하면 테이블이 빈 채로 남는다. 원인을 고치고 이 파일을 다시 실행하면 된다.

\set ON_ERROR_STOP on

TRUNCATE TABLE
    request_record,
    loan_correction_history,
    copy_status_history,
    book_change_history,
    staff_account_history,
    loan_renewal,
    loan,
    book_copy,
    book_author,
    author,
    book,
    app_user
RESTART IDENTITY;

\i /docker-entrypoint-initdb.d/20-seed.sql
