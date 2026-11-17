-- 도서관 대출·반납·연체 관리 시스템 / 시연·개발용 초기 데이터
--
-- [실행 시점]
--   * 컨테이너 최초 생성 시 initdb 가 schema.sql(10) 다음에 자동 실행 (20-seed.sql)
--   * 서버에서 데이터만 처음 상태로 되돌릴 때: reset_demo.sql (TRUNCATE 후 이 파일을 다시 실행)
--
-- [시연 계정]
--   로그인 ID: admin, librarian1~3, member_kim/lee/park/choi/jung/han
--   공통 비밀번호: demo-library-2026   (bcrypt, cost 10, $2a$ 형식)
--   ※ 저장소를 볼 수 있는 사람은 누구나 이 비밀번호를 안다.
--     공개된 서버에 올린다면 시연 후 바꾸거나 서버를 내릴 것.
--
-- [작성 원칙]
--   1. ID 를 직접 쓰지 않는다. IDENTITY 시퀀스가 꼬이지 않도록 자동 발급에 맡기고,
--      로그인 ID·소장본 코드·도서 제목 같은 자연 키로 찾아서 연결한다.
--   2. 모든 날짜는 now() 기준 상대값이다. 언제 리셋해도 "6일 연체", "정지 8일 남음"이 유지된다.
--      (now() 는 트랜잭션 안에서 고정되므로 한 번 실행하는 동안 기준 시각이 흔들리지 않는다)
--   3. 업무 데이터 적재는 library_app 권한으로 한다.
--      → API 계정 권한만으로 모든 시나리오를 만들 수 있다는 것도 함께 검증된다.
--   4. 이름·연락처·ISBN·출판사는 모두 가상이다. (ISBN 은 체크 숫자만 맞춘 979-11-9000 대역)
--   5. category_code(CS/NOVEL/HISTORY/SCIENCE)는 임시 코드다. 팀에서 목록이 정해지면 바꾼다.

\set ON_ERROR_STOP on
BEGIN;

-- ------------------------------------------------------------
-- 0. 보조 함수 (pg_temp: 이 세션에서만 존재, 끝나면 자동 삭제)
--    library_app 은 TEMP 권한이 없으므로 슈퍼유저로 만든 뒤 SET ROLE 한다.
--    함수는 SECURITY INVOKER 라서 안의 INSERT/UPDATE 는 호출한 library_app 권한으로 실행된다.
-- ------------------------------------------------------------

-- 자연 키 -> ID. 0건이거나 2건 이상이면 바로 오류 (오타가 조용히 NULL 이 되는 것 방지)
CREATE OR REPLACE FUNCTION pg_temp.uid(p_login TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
    SELECT user_id INTO STRICT v FROM app_user WHERE login_id = p_login;
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.cid(p_copy_code TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
    SELECT copy_id INTO STRICT v FROM book_copy WHERE copy_code = p_copy_code;
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.bid(p_title TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
    SELECT book_id INTO STRICT v FROM book WHERE title = p_title;
    RETURN v;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.aid(p_name TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
    SELECT author_id INTO STRICT v FROM author WHERE author_name = p_name;  -- 동명이인이면 오류
    RETURN v;
END $$;

-- 해당 소장본의 "유효한 미반납 대출" (부분 UNIQUE 인덱스 덕분에 최대 1건)
CREATE OR REPLACE FUNCTION pg_temp.open_loan(p_copy_code TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
    SELECT loan_id INTO STRICT v FROM loan
    WHERE copy_id = pg_temp.cid(p_copy_code) AND is_cancelled = FALSE AND returned_at IS NULL;
    RETURN v;
END $$;

-- 요청 지문: 실제 정규화 규칙은 백엔드가 정한다. 여기서는 형식(소문자 hex 64자)만 맞춘다.
CREATE OR REPLACE FUNCTION pg_temp.fp(p_text TEXT) RETURNS TEXT LANGUAGE sql
RETURN encode(sha256(convert_to(p_text, 'UTF8')), 'hex');

-- 정지 캐시 재계산: 미래면 그 값, 아니면 NULL (합산이 아니라 최댓값 — fn_member_suspension_until)
CREATE OR REPLACE FUNCTION pg_temp.refresh_suspension(p_member BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    UPDATE app_user
    SET borrowing_suspended_until = CASE WHEN fn_member_suspension_until(p_member) > now()
                                         THEN fn_member_suspension_until(p_member) END
    WHERE user_id = p_member;
END $$;

-- 대출: p_ago 만큼 과거에 대출한 것으로 등록. 만기일 = 대출일(KST) + 14 (ck_loan_dates 와 같은 식)
CREATE OR REPLACE FUNCTION pg_temp.checkout(p_member TEXT, p_copy TEXT, p_staff TEXT, p_ago INTERVAL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_at  TIMESTAMPTZ := now() - p_ago;
    v_due DATE        := (v_at AT TIME ZONE 'Asia/Seoul')::date + 14;
    v_id  BIGINT;
BEGIN
    INSERT INTO loan (copy_id, member_user_id, checked_out_by_user_id,
                      borrowed_at, initial_due_date, current_due_date)
    VALUES (pg_temp.cid(p_copy), pg_temp.uid(p_member), pg_temp.uid(p_staff),
            v_at, v_due, v_due)
    RETURNING loan_id INTO v_id;
    RETURN v_id;
END $$;

-- 반납: 반납 확정 + 정지 캐시 재계산
CREATE OR REPLACE FUNCTION pg_temp.return_copy(p_copy TEXT, p_staff TEXT, p_ago INTERVAL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_member BIGINT;
BEGIN
    UPDATE loan SET returned_at = now() - p_ago, returned_by_user_id = pg_temp.uid(p_staff)
    WHERE loan_id = pg_temp.open_loan(p_copy)
    RETURNING loan_id, member_user_id INTO v_id, v_member;
    PERFORM pg_temp.refresh_suspension(v_member);
    RETURN v_id;
END $$;

-- 연장: 현재 만기일 + 7 과 연장 기록을 함께 (loan_renewal UNIQUE(loan_id) = 1회 제한)
CREATE OR REPLACE FUNCTION pg_temp.renew_copy(p_copy TEXT, p_ago INTERVAL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT := pg_temp.open_loan(p_copy); v_prev DATE;
BEGIN
    UPDATE loan SET current_due_date = current_due_date + 7
    WHERE loan_id = v_id
    RETURNING current_due_date - 7 INTO v_prev;
    INSERT INTO loan_renewal (loan_id, renewed_at, previous_due_date, new_due_date)
    VALUES (v_id, now() - p_ago, v_prev, v_prev + 7);
    RETURN v_id;
END $$;

-- 대출 취소(정정): 행을 지우지 않고 is_cancelled 로 무효화 + 정정 이력
CREATE OR REPLACE FUNCTION pg_temp.cancel_copy(p_copy TEXT, p_staff TEXT, p_reason TEXT,
                                               p_evidence TEXT, p_ago INTERVAL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT := pg_temp.open_loan(p_copy); v_at TIMESTAMPTZ := now() - p_ago;
BEGIN
    UPDATE loan SET is_cancelled = TRUE, cancelled_at = v_at WHERE loan_id = v_id;
    INSERT INTO loan_correction_history (loan_id, correction_type, before_values, after_values,
                                         reason, evidence_reference, corrected_by_user_id, corrected_at)
    VALUES (v_id, 'CANCEL_LOAN',
            jsonb_build_object('is_cancelled', FALSE, 'cancelled_at', NULL),
            jsonb_build_object('is_cancelled', TRUE,  'cancelled_at', v_at),
            p_reason, p_evidence, pg_temp.uid(p_staff), v_at);
    RETURN v_id;
END $$;

-- 반납 취소(정정): 해당 소장본의 가장 최근 반납 대출을 미반납으로 되돌림 + 정정 이력
CREATE OR REPLACE FUNCTION pg_temp.undo_return_copy(p_copy TEXT, p_staff TEXT, p_reason TEXT, p_ago INTERVAL)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE r loan%ROWTYPE;
BEGIN
    SELECT * INTO STRICT r FROM loan
    WHERE copy_id = pg_temp.cid(p_copy) AND is_cancelled = FALSE AND returned_at IS NOT NULL
    ORDER BY returned_at DESC LIMIT 1;

    UPDATE loan SET returned_at = NULL, returned_by_user_id = NULL WHERE loan_id = r.loan_id;
    INSERT INTO loan_correction_history (loan_id, correction_type, before_values, after_values,
                                         reason, corrected_by_user_id, corrected_at)
    VALUES (r.loan_id, 'UNDO_RETURN',
            jsonb_build_object('returned_at', r.returned_at, 'returned_by_user_id', r.returned_by_user_id),
            jsonb_build_object('returned_at', NULL, 'returned_by_user_id', NULL),
            p_reason, pg_temp.uid(p_staff), now() - p_ago);
    PERFORM pg_temp.refresh_suspension(r.member_user_id);
    RETURN r.loan_id;
END $$;

-- 소장본 상태 변경 + 이력 (파손·수리·제적)
CREATE OR REPLACE FUNCTION pg_temp.set_copy_status(p_copy TEXT, p_status TEXT, p_reason TEXT,
                                                   p_staff TEXT, p_ago INTERVAL,
                                                   p_related_loan BIGINT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_prev TEXT;
BEGIN
    SELECT management_status INTO STRICT v_prev FROM book_copy
    WHERE copy_id = pg_temp.cid(p_copy) FOR UPDATE;
    UPDATE book_copy SET management_status = p_status WHERE copy_id = pg_temp.cid(p_copy);
    INSERT INTO copy_status_history (copy_id, previous_status, new_status, reason,
                                     changed_by_user_id, related_loan_id, changed_at)
    VALUES (pg_temp.cid(p_copy), v_prev, p_status, p_reason,
            pg_temp.uid(p_staff), p_related_loan, now() - p_ago);
END $$;

-- 회원 탈퇴: 대출·요청 기록의 회원 연결을 끊고 개인정보를 비운다 (행은 남김)
CREATE OR REPLACE FUNCTION pg_temp.withdraw(p_login TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v BIGINT := pg_temp.uid(p_login);
BEGIN
    UPDATE loan           SET member_user_id = NULL WHERE member_user_id = v;
    UPDATE request_record SET actor_user_id  = NULL WHERE actor_user_id  = v;
    UPDATE app_user
    SET account_status = 'WITHDRAWN', login_id = NULL, password_hash = NULL,
        full_name = NULL, contact = NULL, borrowing_suspended_until = NULL
    WHERE user_id = v;
END $$;

-- 여기부터는 API 계정 권한으로 적재
SET ROLE library_app;

-- 함수 호출 결과(한 줄짜리 표)가 로그를 덮지 않도록 출력만 끈다. 오류는 그대로 보인다.
\o /dev/null

-- ------------------------------------------------------------
-- 1. 계정
-- ------------------------------------------------------------
-- librarian2 와 member_jung 은 연락처가 같다:
--   연락처 UNIQUE 는 "활성 회원끼리만"(uq_app_user_active_member_contact) 이므로 허용된다.
INSERT INTO app_user (login_id, password_hash, full_name, contact, role, created_at) VALUES
  ('admin',       '$2a$10$QvMOuJYpeTBzsgj.0Nf5WO3YbCy0HLh9teYTAg.sa1PW2HYkPkCL.', '시스템관리자', '01090000001', 'ADMIN',     now() - interval '180 days'),
  ('librarian1',  '$2a$10$runOssfiAwwL1RRV6LNDceNQDv.WP1mPiloIu4xdKEQihyexghVx6', '오지은',       '01090000002', 'LIBRARIAN', now() - interval '170 days'),
  ('librarian2',  '$2a$10$GOtsv3ZbcfmgW.08VzVyOepdDLV3jfAANAYBqnd3Lf7/2nI3f5Y3e', '윤재민',       '01055550005', 'LIBRARIAN', now() - interval '170 days'),
  ('librarian3',  '$2a$10$j5A19EbKlAK3ued/XfxhYeuuZNHeCgllC./CyC3ClVWyFSI.MmmwC', '서현우',       '01090000004', 'LIBRARIAN', now() - interval '170 days'),
  ('member_kim',  '$2a$10$WkRvJ83DAD3gYAurr8lXlODn8AbFOlU.ZQsLOuKml6Xi8T4THXHHe', '김민준',       '01055550001', 'MEMBER',    now() - interval '120 days'),
  ('member_lee',  '$2a$10$npojXKj0InO89UmwXX2Ug.KvXrpbj1WQMvrI3OCVP.7Phn6g7FQPS', '이서윤',       '01055550002', 'MEMBER',    now() - interval '110 days'),
  ('member_park', '$2a$10$47JX6ruQ5L8F1lCp8IWIieD37RKtL9fqSOeRoLKX8aWzExCctzDfq', '박도현',       '01055550003', 'MEMBER',    now() - interval '100 days'),
  ('member_choi', '$2a$10$lIyI7XCQybimgyhJ5knzsOEfenuHqxoTU4rUwbWA9rQUlF4aEg4vW', '최하은',       '01055550004', 'MEMBER',    now() - interval '90 days'),
  ('member_jung', '$2a$10$rov3SvKjDf4VOhuae8qebeoLGyvQ0dgC16URlLjsSY043x67fq2i2', '정우진',       '01055550005', 'MEMBER',    now() - interval '30 days'),
  ('member_han',  '$2a$10$qiKF.SkMJfJBefulFWIXvOc6HjDgP4j/6QiiTlNLlKbHNlMeqFOIe', '한지아',       '01055550006', 'MEMBER',    now() - interval '100 days');

-- 직원 계정 이력: 최초 관리자는 처리자 없이 생성 (ck_staff_history_admin_required 의 CREATE 예외)
INSERT INTO staff_account_history
       (target_staff_user_id, action_type, new_status, role_at_creation, processed_by_admin_user_id, processed_at)
VALUES (pg_temp.uid('admin'),      'CREATE', 'ACTIVE', 'ADMIN',     NULL,                 now() - interval '180 days'),
       (pg_temp.uid('librarian1'), 'CREATE', 'ACTIVE', 'LIBRARIAN', pg_temp.uid('admin'), now() - interval '170 days'),
       (pg_temp.uid('librarian2'), 'CREATE', 'ACTIVE', 'LIBRARIAN', pg_temp.uid('admin'), now() - interval '170 days'),
       (pg_temp.uid('librarian3'), 'CREATE', 'ACTIVE', 'LIBRARIAN', pg_temp.uid('admin'), now() - interval '170 days');

-- ------------------------------------------------------------
-- 2. 도서·저자·소장본
-- ------------------------------------------------------------
INSERT INTO book (isbn, title, publisher, publication_year, category_code) VALUES
  ('9791190000017', '데이터베이스 설계 입문', '가람컴퓨팅', 2024, 'CS'),
  ('9791190000024', '실전 SQL 튜님',          '가람컴퓨팅', 2023, 'CS'),      -- 제목 오타 -> 아래에서 수정 이력
  ('9791190000031', '운영체제 이야기',        '누리출판',   2022, 'CS'),
  ('9791190000048', '바다의 시간',            '물결문고',   2021, 'NOVEL'),
  (NULL,            '겨울 정원',              '물결문고',   1998, 'NOVEL'),     -- ISBN 없는 옛 도서
  ('9791190000055', '조선의 장시',            '한올역사',   2020, 'HISTORY'),
  ('9791190000062', '별을 세는 물리학',       '누리출판',   2023, 'SCIENCE'),
  (NULL,            '전산 실무 편람 1995',    NULL,         1995, 'CS'),        -- 전 소장본 제적 -> 비공개
  ('9791190000079', '미입고 신간 안내서',     '가람컴퓨팅', 2026, 'CS'),        -- 소장본 0권 -> 비공개
  ('9791190000086', '세계 지리 산책',         '한올역사',   2019, 'SCIENCE');   -- 파손본만 -> 공개·대출 0권

-- 동명이인: '박지훈' 두 명 (author_name 에 UNIQUE 가 없어서 가능)
INSERT INTO author (author_name) VALUES
  ('김도윤'), ('이서연'), ('박지훈'), ('박지훈'), ('정하늘'),
  ('최유나'), ('한소희'), ('문태오'), ('강별'), ('전산편집위원회'), ('나리');

INSERT INTO book_author (book_id, author_id)
SELECT pg_temp.bid(t), pg_temp.aid(a)
FROM (VALUES ('데이터베이스 설계 입문', '김도윤'),
             ('데이터베이스 설계 입문', '이서연'),   -- 공저
             ('바다의 시간',            '최유나'),
             ('겨울 정원',              '한소희'),
             ('조선의 장시',            '문태오'),
             ('별을 세는 물리학',       '강별'),
             ('전산 실무 편람 1995',    '전산편집위원회'),
             ('미입고 신간 안내서',     '김도윤'),
             ('세계 지리 산책',         '나리')) v(t, a);

-- 동명이인은 이름으로 못 찾으므로 등록 순서로 구분: 먼저 등록 = SQL 책 저자, 나중 = 운영체제 책 저자
INSERT INTO book_author (book_id, author_id) VALUES
  (pg_temp.bid('실전 SQL 튜님'),   (SELECT min(author_id) FROM author WHERE author_name = '박지훈')),
  (pg_temp.bid('운영체제 이야기'), (SELECT max(author_id) FROM author WHERE author_name = '박지훈'));

INSERT INTO book_copy (book_id, copy_code)
SELECT pg_temp.bid(t), c
FROM (VALUES ('데이터베이스 설계 입문', 'CS-0001-01'),
             ('데이터베이스 설계 입문', 'CS-0001-02'),
             ('데이터베이스 설계 입문', 'CS-0001-03'),
             ('실전 SQL 튜님',          'CS-0002-01'),
             ('실전 SQL 튜님',          'CS-0002-02'),
             ('운영체제 이야기',        'CS-0003-01'),
             ('바다의 시간',            'NV-0004-01'),
             ('바다의 시간',            'NV-0004-02'),
             ('바다의 시간',            'NV-0004-03'),
             ('겨울 정원',              'NV-0005-01'),
             ('겨울 정원',              'NV-0005-02'),
             ('조선의 장시',            'HS-0006-01'),
             ('조선의 장시',            'HS-0006-02'),
             ('별을 세는 물리학',       'SC-0007-01'),
             ('전산 실무 편람 1995',    'CS-0008-01'),
             ('전산 실무 편람 1995',    'CS-0008-02'),
             ('세계 지리 산책',         'SC-0010-01')) v(t, c);

-- 처음부터 파손 상태로 등록된 기증본: 이전 상태 NULL 인 이력 1건
INSERT INTO book_copy (book_id, copy_code, management_status)
VALUES (pg_temp.bid('별을 세는 물리학'), 'SC-0007-02', 'DAMAGED');
INSERT INTO copy_status_history (copy_id, previous_status, new_status, reason, changed_by_user_id, changed_at)
VALUES (pg_temp.cid('SC-0007-02'), NULL, 'DAMAGED', '기증 도서 — 표지 일부가 찢어진 상태로 등록',
        pg_temp.uid('librarian2'), now() - interval '60 days');

-- 서지정보 수정 이력: 제목 오타 수정 + 공저자 추가 (JSONB 스냅샷에 저자 목록까지 기록)
UPDATE book SET title = '실전 SQL 튜닝' WHERE title = '실전 SQL 튜님';
INSERT INTO book_author (book_id, author_id)
VALUES (pg_temp.bid('실전 SQL 튜닝'), pg_temp.aid('정하늘'));
INSERT INTO book_change_history (book_id, changed_by_user_id, changed_at, before_values, after_values)
SELECT pg_temp.bid('실전 SQL 튜닝'), pg_temp.uid('librarian1'), now() - interval '50 days',
       jsonb_build_object('title', '실전 SQL 튜님',
                          'author_ids', jsonb_build_array(min(author_id) FILTER (WHERE author_name = '박지훈'))),
       jsonb_build_object('title', '실전 SQL 튜닝',
                          'author_ids', jsonb_build_array(min(author_id) FILTER (WHERE author_name = '박지훈'),
                                                          min(author_id) FILTER (WHERE author_name = '정하늘')))
FROM author;

-- 소장본 상태 변화
-- (1) 수리: ACTIVE -> DAMAGED -> ACTIVE (DAMAGED 는 되돌릴 수 있음)
SELECT pg_temp.set_copy_status('HS-0006-01', 'DAMAGED', '음료에 젖어 일부 페이지 오염', 'librarian1', '30 days');
SELECT pg_temp.set_copy_status('HS-0006-01', 'ACTIVE',  '건조·수선 완료',               'librarian1', '20 days');
-- (2) 제적: 두 권 모두 RETIRED -> 도서 자체가 일반 검색에서 비공개
SELECT pg_temp.set_copy_status('CS-0008-01', 'RETIRED', '구판·내용 노후로 제적', 'librarian2', '45 days');
SELECT pg_temp.set_copy_status('CS-0008-02', 'RETIRED', '구판·내용 노후로 제적', 'librarian2', '45 days');

-- ------------------------------------------------------------
-- 3. 대출 시나리오
-- ------------------------------------------------------------

-- [member_han] 과거 대출 2건 (1건은 1일 늦게 반납 -> 정지는 이미 끝남), 반납 시 파손 확인 -> 탈퇴
SELECT pg_temp.checkout('member_han', 'NV-0004-03', 'librarian3', '70 days');
SELECT pg_temp.return_copy('NV-0004-03', 'librarian3', '60 days');
SELECT pg_temp.checkout('member_han', 'SC-0010-01', 'librarian1', '50 days');
SELECT pg_temp.return_copy('SC-0010-01', 'librarian1', '35 days');
SELECT pg_temp.set_copy_status('SC-0010-01', 'DAMAGED', '반납 시 책등 파손 확인', 'librarian1', '35 days',
       (SELECT loan_id FROM loan WHERE copy_id = pg_temp.cid('SC-0010-01')
        ORDER BY borrowed_at DESC LIMIT 1));

-- [member_kim] 정시 반납 이력 (휴직 전 librarian3 가 처리)
SELECT pg_temp.checkout('member_kim', 'CS-0003-01', 'librarian3', '40 days');
SELECT pg_temp.return_copy('CS-0003-01', 'librarian1', '30 days');

-- [librarian3] 휴직으로 비활성화 (과거 처리 기록은 그대로 남음)
UPDATE app_user SET account_status = 'INACTIVE' WHERE login_id = 'librarian3';
INSERT INTO staff_account_history
       (target_staff_user_id, action_type, previous_status, new_status, reason, processed_by_admin_user_id, processed_at)
VALUES (pg_temp.uid('librarian3'), 'DEACTIVATE', 'ACTIVE', 'INACTIVE', '휴직', pg_temp.uid('admin'), now() - interval '20 days');

-- [member_park] 24일 전 대출 -> 어제 반납: 만기 10일 전, 반납일 기준 9일 연체 -> 약 8일 정지 남음
SELECT pg_temp.checkout('member_park', 'HS-0006-02', 'librarian1', '24 days');
SELECT pg_temp.return_copy('HS-0006-02', 'librarian2', '1 day');

-- [member_lee] 20일 전 대출, 미반납 -> 6일 연체 중 (신규 대출·연장 불가 대상)
SELECT pg_temp.checkout('member_lee', 'CS-0002-01', 'librarian1', '20 days');
SELECT pg_temp.checkout('member_lee', 'NV-0005-01', 'librarian2', '5 days');

-- [member_lee -> member_kim] 바코드 오인식: 이서윤 앞으로 잘못 대출 -> 취소 -> 같은 소장본을 김민준에게 대출
--   취소된 대출은 부분 UNIQUE 인덱스(uq_loan_valid_unreturned_copy) 대상이 아니어서 같은 소장본을 다시 빌려줄 수 있다.
SELECT pg_temp.checkout('member_lee', 'CS-0001-01', 'librarian1', '3 days 02:00');
SELECT pg_temp.cancel_copy('CS-0001-01', 'librarian1', '회원증 오인식으로 다른 회원에게 대출 처리됨',
                           '대출 데스크 처리 메모 2건', '3 days 01:50');
SELECT pg_temp.checkout('member_kim', 'CS-0001-01', 'librarian1', '3 days 01:40');

-- [member_kim] 10일 전 대출 -> 2일 전 연장 1회 (만기 +7일, 다시 연장 불가)
SELECT pg_temp.checkout('member_kim', 'NV-0004-01', 'librarian2', '10 days');
SELECT pg_temp.renew_copy('NV-0004-01', '2 days');

-- [member_choi] 대출 한도(5권) 꽉 참
SELECT pg_temp.checkout('member_choi', 'CS-0001-02', 'librarian1', '14 days');  -- 만기일 = 오늘 (연체 아님, 경계값)
SELECT pg_temp.checkout('member_choi', 'NV-0004-02', 'librarian2', '9 days');
SELECT pg_temp.checkout('member_choi', 'HS-0006-01', 'librarian1', '8 days');   -- 수리 후 다시 대출된 소장본
SELECT pg_temp.checkout('member_choi', 'SC-0007-01', 'librarian2', '7 days');
SELECT pg_temp.checkout('member_choi', 'CS-0002-02', 'librarian1', '6 days');
--   잘못된 반납 처리 -> 반납 취소로 미반납 복구
SELECT pg_temp.return_copy('CS-0002-02', 'librarian2', '1 day 02:00');
SELECT pg_temp.undo_return_copy('CS-0002-02', 'librarian1',
                                '다른 도서를 반납 처리함 — 실물 미반납 확인', '1 day 01:00');

-- [member_jung] 대출 기록 없음: 시연 중 신규 대출 대상

-- ------------------------------------------------------------
-- 4. 요청 기록 (재전송 판단용) — 완료 3건 + 업무 규칙으로 거절된 1건
-- ------------------------------------------------------------
INSERT INTO request_record (request_id, operation_type, request_fingerprint, processing_status,
                            result_code, response_snapshot, actor_user_id, target_loan_id,
                            requested_at, completed_at)
SELECT gen_random_uuid(), 'CHECKOUT',
       pg_temp.fp('CHECKOUT|member=' || l.member_user_id || '|copy=' || l.copy_id),
       'COMPLETED', 'LOAN_CREATED',
       jsonb_build_object('loan_id', l.loan_id, 'due_date', l.current_due_date),
       pg_temp.uid('librarian1'), l.loan_id, l.borrowed_at, l.borrowed_at + interval '1 second'
FROM loan l WHERE l.loan_id = pg_temp.open_loan('CS-0001-01');

INSERT INTO request_record (request_id, operation_type, request_fingerprint, processing_status,
                            result_code, response_snapshot, actor_user_id, target_loan_id,
                            requested_at, completed_at)
SELECT gen_random_uuid(), 'RENEW',
       pg_temp.fp('RENEW|loan=' || l.loan_id),
       'COMPLETED', 'LOAN_RENEWED',
       jsonb_build_object('loan_id', l.loan_id, 'new_due_date', l.current_due_date),
       pg_temp.uid('member_kim'), l.loan_id, r.renewed_at, r.renewed_at + interval '1 second'
FROM loan l JOIN loan_renewal r ON r.loan_id = l.loan_id
WHERE l.loan_id = pg_temp.open_loan('NV-0004-01');

INSERT INTO request_record (request_id, operation_type, request_fingerprint, processing_status,
                            result_code, response_snapshot, actor_user_id, target_loan_id,
                            requested_at, completed_at)
SELECT gen_random_uuid(), 'RETURN',
       pg_temp.fp('RETURN|copy=' || l.copy_id),
       'COMPLETED', 'LOAN_RETURNED',
       jsonb_build_object('loan_id', l.loan_id,
                          'overdue_days', fn_overdue_days(l.current_due_date, l.returned_at),
                          'suspended_until', fn_suspension_end(l.returned_at, l.current_due_date)),
       pg_temp.uid('librarian2'), l.loan_id, l.returned_at, l.returned_at + interval '1 second'
FROM loan l
WHERE l.copy_id = pg_temp.cid('HS-0006-02') AND l.member_user_id = pg_temp.uid('member_park');

-- 연체 중인 회원에게 대출 시도 -> 업무 규칙 위반으로 FAILED (대출 행은 생기지 않음)
INSERT INTO request_record (request_id, operation_type, request_fingerprint, processing_status,
                            result_code, response_snapshot, actor_user_id,
                            requested_at, completed_at)
VALUES (gen_random_uuid(), 'CHECKOUT',
        pg_temp.fp('CHECKOUT|member=' || pg_temp.uid('member_lee') || '|copy=' || pg_temp.cid('CS-0003-01')),
        'FAILED', 'MEMBER_HAS_OVERDUE_LOAN',
        jsonb_build_object('message', '연체 중인 대출이 있어 대출할 수 없습니다'),
        pg_temp.uid('librarian1'), now() - interval '1 hour', now() - interval '1 hour' + interval '1 second');

-- ------------------------------------------------------------
-- 5. 회원 탈퇴 (모든 기록을 만든 뒤 마지막에)
-- ------------------------------------------------------------
SELECT pg_temp.withdraw('member_han');

\o
RESET ROLE;

-- 적재 결과 요약 (initdb 로그 / reset_demo 출력에서 확인)
SELECT 'app_user' AS table_name, count(*) FROM app_user
UNION ALL SELECT 'book',                    count(*) FROM book
UNION ALL SELECT 'author',                  count(*) FROM author
UNION ALL SELECT 'book_author',             count(*) FROM book_author
UNION ALL SELECT 'book_copy',               count(*) FROM book_copy
UNION ALL SELECT 'loan',                    count(*) FROM loan
UNION ALL SELECT 'loan_renewal',            count(*) FROM loan_renewal
UNION ALL SELECT 'staff_account_history',   count(*) FROM staff_account_history
UNION ALL SELECT 'book_change_history',     count(*) FROM book_change_history
UNION ALL SELECT 'copy_status_history',     count(*) FROM copy_status_history
UNION ALL SELECT 'loan_correction_history', count(*) FROM loan_correction_history
UNION ALL SELECT 'request_record',          count(*) FROM request_record;

COMMIT;
