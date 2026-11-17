#!/bin/sh
# DB 계정 3분리 + 기본 권한. 볼륨이 비어 있을 때 최초 1회 실행된다.
#   library_owner    : 테이블·함수의 소유자. 로그인 불가(NOLOGIN). 스키마 파일은 SET ROLE 로 이 역할이 되어 객체를 만든다.
#   library_app      : 백엔드 API 접속용. 데이터 조회·추가·수정만. CREATE/ALTER/DROP 불가 → ORM create_all/Alembic 이 스키마를 못 바꾼다.
#   library_readonly : 교수님 원격 접속·조회용. SELECT 만.
# 비밀번호는 .env 에서만 받는다(파일에 하드코딩 금지).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v app_pw="$LIBRARY_APP_PASSWORD" \
     -v ro_pw="$LIBRARY_READONLY_PASSWORD" \
     -v db="$POSTGRES_DB" <<'EOSQL'
CREATE ROLE library_owner NOLOGIN;
CREATE ROLE library_app LOGIN PASSWORD :'app_pw';
CREATE ROLE library_readonly LOGIN PASSWORD :'ro_pw';

-- 데이터베이스 접속은 지정한 계정만
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO library_app, library_readonly;

-- public 스키마는 owner 소유. 다른 계정은 사용(USAGE)만, 객체 생성(CREATE) 불가
ALTER SCHEMA public OWNER TO library_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO library_app, library_readonly;

-- 앞으로 library_owner 가 만드는 객체에 자동으로 붙는 권한
-- DELETE 는 기본으로 주지 않는다(이력 보존·삭제 제한). 꼭 필요한 테이블에만 스키마에서 따로 GRANT 한다.
ALTER DEFAULT PRIVILEGES FOR ROLE library_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO library_app;
ALTER DEFAULT PRIVILEGES FOR ROLE library_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO library_app;
ALTER DEFAULT PRIVILEGES FOR ROLE library_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO library_readonly;

-- 화면·조회 시 TIMESTAMPTZ 를 한국 시간으로 표시 (연체 판정은 SQL 에서 AT TIME ZONE 'Asia/Seoul' 명시)
ALTER DATABASE :"db" SET timezone TO 'Asia/Seoul';
EOSQL
