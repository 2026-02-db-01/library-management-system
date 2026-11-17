export type TableName =
  | "app_user"
  | "book"
  | "author"
  | "book_author"
  | "book_copy"
  | "loan"
  | "loan_renewal"
  | "staff_account_history"
  | "book_change_history"
  | "copy_status_history"
  | "loan_correction_history"
  | "request_record";
export type ConstraintKind = "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | "CHECK";
export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  key?: "PK" | "FK" | "UNIQUE";
  reference?: string;
  description: string;
}
export interface ConstraintMetadata {
  name: string;
  kind: ConstraintKind;
  columns: string[];
  definition: string;
  purpose: string;
  reference?: string;
}
export interface IndexMetadata {
  name: string;
  definition: string;
  unique: boolean;
  partial: boolean;
  purpose: string;
}
export interface TableMetadata {
  name: TableName;
  label: string;
  description: string;
  columns: ColumnMetadata[];
  constraints: ConstraintMetadata[];
  indexes: IndexMetadata[];
}
export const tableOrder: TableName[] = [
  "app_user",
  "book",
  "author",
  "book_author",
  "book_copy",
  "loan",
  "loan_renewal",
  "staff_account_history",
  "book_change_history",
  "copy_status_history",
  "loan_correction_history",
  "request_record",
];
export const tableMetadata: Record<TableName, TableMetadata> = {
  app_user: {
    name: "app_user",
    label: "사용자 계정",
    description: "사용자 계정 · Wiki 물리 모델",
    columns: [
      {
        name: "user_id",
        type: "BIGINT",
        nullable: false,
        description: "계정 내부 식별자",
        key: "PK",
      },
      {
        name: "login_id",
        type: "VARCHAR(50)",
        nullable: true,
        description: "로그인 ID; 탈퇴 시 제거",
        key: "UNIQUE",
      },
      {
        name: "password_hash",
        type: "TEXT",
        nullable: true,
        description: "안전한 비밀번호 해시; 탈퇴 시 제거",
      },
      {
        name: "full_name",
        type: "VARCHAR(100)",
        nullable: true,
        description: "본인 이름; 탈퇴 시 제거",
      },
      {
        name: "contact",
        type: "VARCHAR(11)",
        nullable: true,
        description: "본인 연락처; 탈퇴 시 제거",
        key: "UNIQUE",
      },
      {
        name: "role",
        type: "VARCHAR(16)",
        nullable: false,
        description: "**생성 시 고정** 역할",
      },
      {
        name: "account_status",
        type: "VARCHAR(16)",
        nullable: false,
        description: "MEMBER: ACTIVE/WITHDRAWN, 직원: ACTIVE/INACTIVE",
        defaultValue: "ACTIVE",
      },
      {
        name: "borrowing_suspended_until",
        type: "TIMESTAMPTZ",
        nullable: true,
        description: "회원의 반납 후 신규 대출 정지 종료시각",
      },
      {
        name: "created_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "계정 생성 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
    constraints: [
      {
        name: "pk_app_user",
        kind: "PRIMARY KEY",
        columns: ["user_id"],
        definition: "PRIMARY KEY (user_id)",
        purpose: "고유 식별",
      },
      {
        name: "unique_app_user_login_id",
        kind: "UNIQUE",
        columns: ["login_id"],
        definition: "UNIQUE (login_id)",
        purpose: "UK, 일반 계정은 필수",
      },
      {
        name: "unique_app_user_contact",
        kind: "UNIQUE",
        columns: ["contact"],
        definition: "UNIQUE (contact)",
        purpose: "정규식 숫자 10–11자리, 활성 회원 부분 UK",
      },
      {
        name: "example_check_app_user_1",
        kind: "CHECK",
        columns: ["role"],
        definition: "CHECK (role IN ('MEMBER','LIBRARIAN','ADMIN'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_app_user_2",
        kind: "CHECK",
        columns: ["role", "account_status"],
        definition:
          "CHECK ((role = 'MEMBER' AND account_status IN ('ACTIVE','WITHDRAWN')) OR (role IN ('LIBRARIAN','ADMIN') AND account_status IN ('ACTIVE','INACTIVE')))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_app_user_3",
        kind: "CHECK",
        columns: ["contact"],
        definition: "CHECK (contact IS NULL OR contact ~ '^[0-9]{10,11}$')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_app_user_4",
        kind: "CHECK",
        columns: [
          "login_id",
          "password_hash",
          "full_name",
          "contact",
          "account_status",
          "borrowing_suspended_until",
        ],
        definition:
          "CHECK ((account_status = 'WITHDRAWN' AND login_id IS NULL AND password_hash IS NULL AND full_name IS NULL AND contact IS NULL AND borrowing_suspended_until IS NULL) OR (account_status <> 'WITHDRAWN' AND login_id IS NOT NULL AND password_hash IS NOT NULL AND full_name IS NOT NULL AND contact IS NOT NULL))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "uq_app_user_active_member_contact",
        definition:
          "CREATE UNIQUE INDEX uq_app_user_active_member_contact ON app_user (contact) WHERE role = 'MEMBER' AND account_status = 'ACTIVE'",
        unique: true,
        partial: true,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  book: {
    name: "book",
    label: "도서 서지정보",
    description: "도서 서지정보 · Wiki 물리 모델",
    columns: [
      {
        name: "book_id",
        type: "BIGINT",
        nullable: false,
        description: "도서 식별자",
        key: "PK",
      },
      {
        name: "isbn",
        type: "VARCHAR(13)",
        nullable: true,
        description: "선택 ISBN",
        key: "UNIQUE",
      },
      {
        name: "title",
        type: "VARCHAR(255)",
        nullable: false,
        description: "도서명",
      },
      {
        name: "publisher",
        type: "VARCHAR(150)",
        nullable: true,
        description: "출판사",
      },
      {
        name: "publication_year",
        type: "SMALLINT",
        nullable: true,
        description: "발행연도",
      },
      {
        name: "category_code",
        type: "VARCHAR(32)",
        nullable: false,
        description: "필수 분류",
      },
    ],
    constraints: [
      {
        name: "pk_book",
        kind: "PRIMARY KEY",
        columns: ["book_id"],
        definition: "PRIMARY KEY (book_id)",
        purpose: "고유 식별",
      },
      {
        name: "unique_book_isbn",
        kind: "UNIQUE",
        columns: ["isbn"],
        definition: "UNIQUE (isbn)",
        purpose: "UK, 숫자 13자리 CHECK(값 존재 시)",
      },
      {
        name: "example_check_book_1",
        kind: "CHECK",
        columns: ["title"],
        definition: "CHECK (length(trim(title)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_book_2",
        kind: "CHECK",
        columns: ["publisher"],
        definition: "CHECK (publisher IS NULL OR length(trim(publisher)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_book_3",
        kind: "CHECK",
        columns: ["publication_year"],
        definition:
          "CHECK (publication_year IS NULL OR publication_year BETWEEN 1 AND 9999)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_book_4",
        kind: "CHECK",
        columns: ["isbn"],
        definition: "CHECK (isbn IS NULL OR isbn ~ '^[0-9]{13}$')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_book_5",
        kind: "CHECK",
        columns: ["category_code"],
        definition: "CHECK (category_code ~ '^[A-Z][A-Z0-9_]{0,31}$')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [],
  },
  author: {
    name: "author",
    label: "저자",
    description: "저자 · Wiki 물리 모델",
    columns: [
      {
        name: "author_id",
        type: "BIGINT",
        nullable: false,
        description: "저자 식별자",
        key: "PK",
      },
      {
        name: "author_name",
        type: "VARCHAR(150)",
        nullable: false,
        description: "저자 이름",
      },
    ],
    constraints: [
      {
        name: "pk_author",
        kind: "PRIMARY KEY",
        columns: ["author_id"],
        definition: "PRIMARY KEY (author_id)",
        purpose: "고유 식별",
      },
      {
        name: "example_check_author_1",
        kind: "CHECK",
        columns: ["author_name"],
        definition: "CHECK (length(trim(author_name)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [],
  },
  book_author: {
    name: "book_author",
    label: "도서–저자 연결",
    description: "도서–저자 연결 · Wiki 물리 모델",
    columns: [
      {
        name: "book_id",
        type: "BIGINT",
        nullable: false,
        description: "서지정보",
        key: "FK",
        reference: "book.book_id",
      },
      {
        name: "author_id",
        type: "BIGINT",
        nullable: false,
        description: "저자",
        key: "FK",
        reference: "author.author_id",
      },
    ],
    constraints: [
      {
        name: "pk_book_author",
        kind: "PRIMARY KEY",
        columns: ["book_id", "author_id"],
        definition: "PRIMARY KEY (book_id, author_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_book_author_book_id",
        kind: "FOREIGN KEY",
        columns: ["book_id"],
        definition: "FOREIGN KEY (book_id) REFERENCES book(book_id)",
        purpose: "서지정보",
        reference: "book.book_id",
      },
      {
        name: "ref_book_author_author_id",
        kind: "FOREIGN KEY",
        columns: ["author_id"],
        definition: "FOREIGN KEY (author_id) REFERENCES author(author_id)",
        purpose: "저자",
        reference: "author.author_id",
      },
    ],
    indexes: [
      {
        name: "idx_book_author_author",
        definition:
          "CREATE INDEX idx_book_author_author ON book_author (author_id)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  book_copy: {
    name: "book_copy",
    label: "실물 소장본",
    description: "실물 소장본 · Wiki 물리 모델",
    columns: [
      {
        name: "copy_id",
        type: "BIGINT",
        nullable: false,
        description: "개별 소장본 ID",
        key: "PK",
      },
      {
        name: "book_id",
        type: "BIGINT",
        nullable: false,
        description: "서지정보 참조",
        key: "FK",
        reference: "book.book_id",
      },
      {
        name: "copy_code",
        type: "VARCHAR(50)",
        nullable: false,
        description: "시스템 발급 관리번호",
        key: "UNIQUE",
      },
      {
        name: "management_status",
        type: "VARCHAR(16)",
        nullable: false,
        description: "실물 상태",
        defaultValue: "ACTIVE",
      },
    ],
    constraints: [
      {
        name: "pk_book_copy",
        kind: "PRIMARY KEY",
        columns: ["copy_id"],
        definition: "PRIMARY KEY (copy_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_book_copy_book_id",
        kind: "FOREIGN KEY",
        columns: ["book_id"],
        definition: "FOREIGN KEY (book_id) REFERENCES book(book_id)",
        purpose: "서지정보 참조",
        reference: "book.book_id",
      },
      {
        name: "unique_book_copy_copy_code",
        kind: "UNIQUE",
        columns: ["copy_code"],
        definition: "UNIQUE (copy_code)",
        purpose: "UK, 공백만 입력 금지",
      },
      {
        name: "example_check_book_copy_1",
        kind: "CHECK",
        columns: ["management_status"],
        definition:
          "CHECK (management_status IN ('ACTIVE','DAMAGED','RETIRED'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_book_copy_2",
        kind: "CHECK",
        columns: ["copy_code"],
        definition: "CHECK (length(trim(copy_code)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_book_copy_book_status",
        definition:
          "CREATE INDEX idx_book_copy_book_status ON book_copy (book_id, management_status)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  loan: {
    name: "loan",
    label: "대출·반납의 현재 유효 상태",
    description: "대출·반납의 현재 유효 상태 · Wiki 물리 모델",
    columns: [
      {
        name: "loan_id",
        type: "BIGINT",
        nullable: false,
        description: "대출 기록 ID",
        key: "PK",
      },
      {
        name: "member_user_id",
        type: "BIGINT",
        nullable: true,
        description: "대출 시 MEMBER 필수, 탈퇴 후 NULL",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "copy_id",
        type: "BIGINT",
        nullable: false,
        description: "대출된 실물 소장본",
        key: "FK",
        reference: "book_copy.copy_id",
      },
      {
        name: "checked_out_by_user_id",
        type: "BIGINT",
        nullable: false,
        description: "대출 처리 사서",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "borrowed_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "대출 확정 시점",
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "initial_due_date",
        type: "DATE",
        nullable: false,
        description: "최초 반납예정일",
      },
      {
        name: "current_due_date",
        type: "DATE",
        nullable: false,
        description: "연장·허용 정정 반영 최종 만기일",
      },
      {
        name: "returned_at",
        type: "TIMESTAMPTZ",
        nullable: true,
        description: "유효한 실제 반납 시점",
      },
      {
        name: "returned_by_user_id",
        type: "BIGINT",
        nullable: true,
        description: "반납 처리 사서",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "is_cancelled",
        type: "BOOLEAN",
        nullable: false,
        description: "원본 보존형 대출 취소 표시",
        defaultValue: "FALSE",
      },
      {
        name: "cancelled_at",
        type: "TIMESTAMPTZ",
        nullable: true,
        description: "취소 확정 시점",
      },
    ],
    constraints: [
      {
        name: "pk_loan",
        kind: "PRIMARY KEY",
        columns: ["loan_id"],
        definition: "PRIMARY KEY (loan_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_loan_member_user_id",
        kind: "FOREIGN KEY",
        columns: ["member_user_id"],
        definition: "FOREIGN KEY (member_user_id) REFERENCES app_user(user_id)",
        purpose: "대출 시 MEMBER 필수, 탈퇴 후 NULL",
        reference: "app_user.user_id",
      },
      {
        name: "ref_loan_copy_id",
        kind: "FOREIGN KEY",
        columns: ["copy_id"],
        definition: "FOREIGN KEY (copy_id) REFERENCES book_copy(copy_id)",
        purpose: "대출된 실물 소장본",
        reference: "book_copy.copy_id",
      },
      {
        name: "ref_loan_checked_out_by_user_id",
        kind: "FOREIGN KEY",
        columns: ["checked_out_by_user_id"],
        definition:
          "FOREIGN KEY (checked_out_by_user_id) REFERENCES app_user(user_id)",
        purpose: "대출 처리 사서",
        reference: "app_user.user_id",
      },
      {
        name: "ref_loan_returned_by_user_id",
        kind: "FOREIGN KEY",
        columns: ["returned_by_user_id"],
        definition:
          "FOREIGN KEY (returned_by_user_id) REFERENCES app_user(user_id)",
        purpose: "반납 처리 사서",
        reference: "app_user.user_id",
      },
      {
        name: "example_check_loan_1",
        kind: "CHECK",
        columns: ["initial_due_date", "current_due_date"],
        definition: "CHECK (current_due_date >= initial_due_date)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_loan_2",
        kind: "CHECK",
        columns: ["returned_at", "returned_by_user_id"],
        definition:
          "CHECK ((returned_at IS NULL) = (returned_by_user_id IS NULL))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_loan_3",
        kind: "CHECK",
        columns: ["borrowed_at", "returned_at"],
        definition: "CHECK (returned_at IS NULL OR returned_at >= borrowed_at)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_loan_4",
        kind: "CHECK",
        columns: ["is_cancelled", "cancelled_at"],
        definition: "CHECK (is_cancelled = (cancelled_at IS NOT NULL))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "uq_loan_valid_unreturned_copy",
        definition:
          "CREATE UNIQUE INDEX uq_loan_valid_unreturned_copy ON loan (copy_id) WHERE is_cancelled = FALSE AND returned_at IS NULL",
        unique: true,
        partial: true,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_member_history",
        definition:
          "CREATE INDEX idx_loan_member_history ON loan (member_user_id, borrowed_at DESC) WHERE member_user_id IS NOT NULL",
        unique: false,
        partial: true,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_copy_history",
        definition:
          "CREATE INDEX idx_loan_copy_history ON loan (copy_id, borrowed_at DESC)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_active_member_due",
        definition:
          "CREATE INDEX idx_loan_active_member_due ON loan (member_user_id, current_due_date) WHERE is_cancelled = FALSE AND returned_at IS NULL",
        unique: false,
        partial: true,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_active_due",
        definition:
          "CREATE INDEX idx_loan_active_due ON loan (current_due_date) WHERE is_cancelled = FALSE AND returned_at IS NULL",
        unique: false,
        partial: true,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_checkout_staff",
        definition:
          "CREATE INDEX idx_loan_checkout_staff ON loan (checked_out_by_user_id)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
      {
        name: "idx_loan_return_staff",
        definition:
          "CREATE INDEX idx_loan_return_staff ON loan (returned_by_user_id)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  loan_renewal: {
    name: "loan_renewal",
    label: "성공한 연장 이력",
    description: "성공한 연장 이력 · Wiki 물리 모델",
    columns: [
      {
        name: "renewal_id",
        type: "BIGINT",
        nullable: false,
        description: "연장 사건 ID",
        key: "PK",
      },
      {
        name: "loan_id",
        type: "BIGINT",
        nullable: false,
        description: "대출당 최대 1회",
        key: "FK",
        reference: "loan.loan_id",
      },
      {
        name: "renewed_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "연장 확정 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "previous_due_date",
        type: "DATE",
        nullable: false,
        description: "변경 전 만기일",
      },
      {
        name: "new_due_date",
        type: "DATE",
        nullable: false,
        description: "변경 후 만기일",
      },
    ],
    constraints: [
      {
        name: "pk_loan_renewal",
        kind: "PRIMARY KEY",
        columns: ["renewal_id"],
        definition: "PRIMARY KEY (renewal_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_loan_renewal_loan_id",
        kind: "FOREIGN KEY",
        columns: ["loan_id"],
        definition: "FOREIGN KEY (loan_id) REFERENCES loan(loan_id)",
        purpose: "대출당 최대 1회",
        reference: "loan.loan_id",
      },
      {
        name: "unique_loan_renewal_loan_id",
        kind: "UNIQUE",
        columns: ["loan_id"],
        definition: "UNIQUE (loan_id)",
        purpose: "**UK**, FK → `loan`",
      },
      {
        name: "example_check_loan_renewal_1",
        kind: "CHECK",
        columns: ["previous_due_date", "new_due_date"],
        definition: "CHECK (new_due_date = previous_due_date + 7)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [],
  },
  staff_account_history: {
    name: "staff_account_history",
    label: "직원 계정 생성·상태 변경 이력",
    description: "직원 계정 생성·상태 변경 이력 · Wiki 물리 모델",
    columns: [
      {
        name: "staff_history_id",
        type: "BIGINT",
        nullable: false,
        description: "이력 ID",
        key: "PK",
      },
      {
        name: "target_staff_user_id",
        type: "BIGINT",
        nullable: false,
        description: "대상 사서·관리자",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "action_type",
        type: "VARCHAR(16)",
        nullable: false,
        description: "업무 유형",
      },
      {
        name: "previous_status",
        type: "VARCHAR(16)",
        nullable: true,
        description: "변경 전 상태",
      },
      {
        name: "new_status",
        type: "VARCHAR(16)",
        nullable: false,
        description: "변경 후 상태",
      },
      {
        name: "role_at_creation",
        type: "VARCHAR(16)",
        nullable: true,
        description: "생성할 때 부여한 역할",
      },
      {
        name: "reason",
        type: "TEXT",
        nullable: true,
        description: "상태 변경 사유",
      },
      {
        name: "processed_by_admin_user_id",
        type: "BIGINT",
        nullable: true,
        description: "처리 관리자; 최초 시스템 생성 예외",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "processed_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "처리 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
    constraints: [
      {
        name: "pk_staff_account_history",
        kind: "PRIMARY KEY",
        columns: ["staff_history_id"],
        definition: "PRIMARY KEY (staff_history_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_staff_account_history_target_staff_user_id",
        kind: "FOREIGN KEY",
        columns: ["target_staff_user_id"],
        definition:
          "FOREIGN KEY (target_staff_user_id) REFERENCES app_user(user_id)",
        purpose: "대상 사서·관리자",
        reference: "app_user.user_id",
      },
      {
        name: "ref_staff_account_history_processed_by_admin_user_id",
        kind: "FOREIGN KEY",
        columns: ["processed_by_admin_user_id"],
        definition:
          "FOREIGN KEY (processed_by_admin_user_id) REFERENCES app_user(user_id)",
        purpose: "처리 관리자; 최초 시스템 생성 예외",
        reference: "app_user.user_id",
      },
      {
        name: "example_check_staff_account_history_1",
        kind: "CHECK",
        columns: ["action_type"],
        definition:
          "CHECK (action_type IN ('CREATE','DEACTIVATE','REACTIVATE'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_staff_account_history_2",
        kind: "CHECK",
        columns: ["new_status"],
        definition: "CHECK (new_status IN ('ACTIVE','INACTIVE'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_staff_account_history_3",
        kind: "CHECK",
        columns: [
          "action_type",
          "previous_status",
          "new_status",
          "role_at_creation",
          "reason",
          "processed_by_admin_user_id",
        ],
        definition:
          "CHECK ((action_type = 'CREATE' AND previous_status IS NULL AND new_status = 'ACTIVE' AND role_at_creation IN ('LIBRARIAN','ADMIN')) OR (action_type IN ('DEACTIVATE','REACTIVATE') AND previous_status IS NOT NULL AND role_at_creation IS NULL AND length(trim(reason)) > 0 AND processed_by_admin_user_id IS NOT NULL))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_staff_history_target",
        definition:
          "CREATE INDEX idx_staff_history_target ON staff_account_history (target_staff_user_id, processed_at DESC)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  book_change_history: {
    name: "book_change_history",
    label: "서지정보 수정 이력",
    description: "서지정보 수정 이력 · Wiki 물리 모델",
    columns: [
      {
        name: "book_change_id",
        type: "BIGINT",
        nullable: false,
        description: "변경 이력 ID",
        key: "PK",
      },
      {
        name: "book_id",
        type: "BIGINT",
        nullable: false,
        description: "변경 대상 도서",
        key: "FK",
        reference: "book.book_id",
      },
      {
        name: "changed_by_user_id",
        type: "BIGINT",
        nullable: false,
        description: "수정한 사서",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "changed_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "변경 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "before_values",
        type: "JSONB",
        nullable: false,
        description: "변경 전 서지정보·저자 연결 스냅샷",
      },
      {
        name: "after_values",
        type: "JSONB",
        nullable: false,
        description: "변경 후 서지정보·저자 연결 스냅샷",
      },
    ],
    constraints: [
      {
        name: "pk_book_change_history",
        kind: "PRIMARY KEY",
        columns: ["book_change_id"],
        definition: "PRIMARY KEY (book_change_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_book_change_history_book_id",
        kind: "FOREIGN KEY",
        columns: ["book_id"],
        definition: "FOREIGN KEY (book_id) REFERENCES book(book_id)",
        purpose: "변경 대상 도서",
        reference: "book.book_id",
      },
      {
        name: "ref_book_change_history_changed_by_user_id",
        kind: "FOREIGN KEY",
        columns: ["changed_by_user_id"],
        definition:
          "FOREIGN KEY (changed_by_user_id) REFERENCES app_user(user_id)",
        purpose: "수정한 사서",
        reference: "app_user.user_id",
      },
      {
        name: "example_check_book_change_history_1",
        kind: "CHECK",
        columns: ["before_values", "after_values"],
        definition:
          "CHECK (jsonb_typeof(before_values) = 'object' AND jsonb_typeof(after_values) = 'object')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_book_change_target",
        definition:
          "CREATE INDEX idx_book_change_target ON book_change_history (book_id, changed_at DESC)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  copy_status_history: {
    name: "copy_status_history",
    label: "소장본 상태 변경 이력",
    description: "소장본 상태 변경 이력 · Wiki 물리 모델",
    columns: [
      {
        name: "copy_status_history_id",
        type: "BIGINT",
        nullable: false,
        description: "변경 이력 ID",
        key: "PK",
      },
      {
        name: "copy_id",
        type: "BIGINT",
        nullable: false,
        description: "대상 소장본",
        key: "FK",
        reference: "book_copy.copy_id",
      },
      {
        name: "previous_status",
        type: "VARCHAR(16)",
        nullable: true,
        description: "이전 상태",
      },
      {
        name: "new_status",
        type: "VARCHAR(16)",
        nullable: false,
        description: "새로운 상태",
      },
      {
        name: "reason",
        type: "TEXT",
        nullable: false,
        description: "파손·수리·제적 사유",
      },
      {
        name: "changed_by_user_id",
        type: "BIGINT",
        nullable: false,
        description: "처리 사서",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "related_loan_id",
        type: "BIGINT",
        nullable: true,
        description: "반납 중 파손 확인 시 선택",
        key: "FK",
        reference: "loan.loan_id",
      },
      {
        name: "changed_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "변경 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
    constraints: [
      {
        name: "pk_copy_status_history",
        kind: "PRIMARY KEY",
        columns: ["copy_status_history_id"],
        definition: "PRIMARY KEY (copy_status_history_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_copy_status_history_copy_id",
        kind: "FOREIGN KEY",
        columns: ["copy_id"],
        definition: "FOREIGN KEY (copy_id) REFERENCES book_copy(copy_id)",
        purpose: "대상 소장본",
        reference: "book_copy.copy_id",
      },
      {
        name: "ref_copy_status_history_changed_by_user_id",
        kind: "FOREIGN KEY",
        columns: ["changed_by_user_id"],
        definition:
          "FOREIGN KEY (changed_by_user_id) REFERENCES app_user(user_id)",
        purpose: "처리 사서",
        reference: "app_user.user_id",
      },
      {
        name: "ref_copy_status_history_related_loan_id",
        kind: "FOREIGN KEY",
        columns: ["related_loan_id"],
        definition: "FOREIGN KEY (related_loan_id) REFERENCES loan(loan_id)",
        purpose: "반납 중 파손 확인 시 선택",
        reference: "loan.loan_id",
      },
      {
        name: "example_check_copy_status_history_1",
        kind: "CHECK",
        columns: ["new_status"],
        definition: "CHECK (new_status IN ('ACTIVE','DAMAGED','RETIRED'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_copy_status_history_2",
        kind: "CHECK",
        columns: ["previous_status"],
        definition:
          "CHECK (previous_status IS NULL OR previous_status IN ('ACTIVE','DAMAGED','RETIRED'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_copy_status_history_3",
        kind: "CHECK",
        columns: ["reason"],
        definition: "CHECK (length(trim(reason)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_copy_status_target",
        definition:
          "CREATE INDEX idx_copy_status_target ON copy_status_history (copy_id, changed_at DESC)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  loan_correction_history: {
    name: "loan_correction_history",
    label: "대출·반납 정정 이력",
    description: "대출·반납 정정 이력 · Wiki 물리 모델",
    columns: [
      {
        name: "correction_id",
        type: "BIGINT",
        nullable: false,
        description: "정정 이력 ID",
        key: "PK",
      },
      {
        name: "loan_id",
        type: "BIGINT",
        nullable: false,
        description: "대상 대출",
        key: "FK",
        reference: "loan.loan_id",
      },
      {
        name: "correction_type",
        type: "VARCHAR(32)",
        nullable: false,
        description: "정정 유형",
      },
      {
        name: "before_values",
        type: "JSONB",
        nullable: false,
        description: "원래 처리 사실의 스냅샷",
      },
      {
        name: "after_values",
        type: "JSONB",
        nullable: false,
        description: "정정 후 사실의 스냅샷",
      },
      {
        name: "reason",
        type: "TEXT",
        nullable: false,
        description: "정정 사유",
      },
      {
        name: "evidence_reference",
        type: "TEXT",
        nullable: true,
        description: "정정 근거 참조",
      },
      {
        name: "corrected_by_user_id",
        type: "BIGINT",
        nullable: false,
        description: "처리 사서",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "corrected_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "정정 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
    ],
    constraints: [
      {
        name: "pk_loan_correction_history",
        kind: "PRIMARY KEY",
        columns: ["correction_id"],
        definition: "PRIMARY KEY (correction_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_loan_correction_history_loan_id",
        kind: "FOREIGN KEY",
        columns: ["loan_id"],
        definition: "FOREIGN KEY (loan_id) REFERENCES loan(loan_id)",
        purpose: "대상 대출",
        reference: "loan.loan_id",
      },
      {
        name: "ref_loan_correction_history_corrected_by_user_id",
        kind: "FOREIGN KEY",
        columns: ["corrected_by_user_id"],
        definition:
          "FOREIGN KEY (corrected_by_user_id) REFERENCES app_user(user_id)",
        purpose: "처리 사서",
        reference: "app_user.user_id",
      },
      {
        name: "example_check_loan_correction_history_1",
        kind: "CHECK",
        columns: ["correction_type"],
        definition:
          "CHECK (correction_type IN ('CANCEL_LOAN','UNDO_RETURN','CORRECT_DUE_DATE','CORRECT_RETURNED_AT'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_loan_correction_history_2",
        kind: "CHECK",
        columns: ["reason"],
        definition: "CHECK (length(trim(reason)) > 0)",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_loan_correction_history_3",
        kind: "CHECK",
        columns: ["before_values", "after_values"],
        definition:
          "CHECK (jsonb_typeof(before_values) = 'object' AND jsonb_typeof(after_values) = 'object')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_correction_target",
        definition:
          "CREATE INDEX idx_correction_target ON loan_correction_history (loan_id, corrected_at DESC)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
  request_record: {
    name: "request_record",
    label: "중복 요청 처리 기록",
    description: "중복 요청 처리 기록 · Wiki 물리 모델",
    columns: [
      {
        name: "request_id",
        type: "UUID",
        nullable: false,
        description: "클라이언트 요청 식별자",
        key: "PK",
      },
      {
        name: "operation_type",
        type: "VARCHAR(16)",
        nullable: false,
        description: "업무 구분",
      },
      {
        name: "request_fingerprint",
        type: "CHAR(64)",
        nullable: false,
        description: "요청 내용 동일성 비교용 지문",
      },
      {
        name: "processing_status",
        type: "VARCHAR(16)",
        nullable: false,
        description: "PENDING/COMPLETED/FAILED",
        defaultValue: "PENDING",
      },
      {
        name: "result_code",
        type: "VARCHAR(64)",
        nullable: true,
        description: "처리 결과 코드",
      },
      {
        name: "response_snapshot",
        type: "JSONB",
        nullable: true,
        description: "개인정보 없는 결과 요약",
      },
      {
        name: "actor_user_id",
        type: "BIGINT",
        nullable: true,
        description: "요청자; 회원 탈퇴 시 연결 해제",
        key: "FK",
        reference: "app_user.user_id",
      },
      {
        name: "target_loan_id",
        type: "BIGINT",
        nullable: true,
        description: "관련 대출이 있을 때 참조",
        key: "FK",
        reference: "loan.loan_id",
      },
      {
        name: "requested_at",
        type: "TIMESTAMPTZ",
        nullable: false,
        description: "요청 시각",
        defaultValue: "CURRENT_TIMESTAMP",
      },
      {
        name: "completed_at",
        type: "TIMESTAMPTZ",
        nullable: true,
        description: "처리 완료 시각",
      },
    ],
    constraints: [
      {
        name: "pk_request_record",
        kind: "PRIMARY KEY",
        columns: ["request_id"],
        definition: "PRIMARY KEY (request_id)",
        purpose: "고유 식별",
      },
      {
        name: "ref_request_record_actor_user_id",
        kind: "FOREIGN KEY",
        columns: ["actor_user_id"],
        definition: "FOREIGN KEY (actor_user_id) REFERENCES app_user(user_id)",
        purpose: "요청자; 회원 탈퇴 시 연결 해제",
        reference: "app_user.user_id",
      },
      {
        name: "ref_request_record_target_loan_id",
        kind: "FOREIGN KEY",
        columns: ["target_loan_id"],
        definition: "FOREIGN KEY (target_loan_id) REFERENCES loan(loan_id)",
        purpose: "관련 대출이 있을 때 참조",
        reference: "loan.loan_id",
      },
      {
        name: "example_check_request_record_1",
        kind: "CHECK",
        columns: ["operation_type"],
        definition:
          "CHECK (operation_type IN ('CHECKOUT','RETURN','RENEW','CORRECT'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_request_record_2",
        kind: "CHECK",
        columns: ["request_fingerprint"],
        definition: "CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_request_record_3",
        kind: "CHECK",
        columns: ["processing_status"],
        definition:
          "CHECK (processing_status IN ('PENDING','COMPLETED','FAILED'))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_request_record_4",
        kind: "CHECK",
        columns: ["processing_status", "result_code", "completed_at"],
        definition:
          "CHECK ((processing_status = 'PENDING' AND completed_at IS NULL) OR (processing_status IN ('COMPLETED','FAILED') AND completed_at IS NOT NULL AND result_code IS NOT NULL))",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
      {
        name: "example_check_request_record_5",
        kind: "CHECK",
        columns: ["response_snapshot"],
        definition:
          "CHECK (response_snapshot IS NULL OR jsonb_typeof(response_snapshot) = 'object')",
        purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
      },
    ],
    indexes: [
      {
        name: "idx_request_target_loan",
        definition:
          "CREATE INDEX idx_request_target_loan ON request_record (target_loan_id)",
        unique: false,
        partial: false,
        purpose: "Wiki 무결성·조회 인덱스",
      },
    ],
  },
};
export const relationships = [
  {
    id: "book-book_author",
    constraint: "ref_book_author_book_id",
    from: "book",
    to: "book_author",
    fromColumn: "book_id",
    toColumn: "book_id",
    label: "book.book_id → book_author.book_id",
    cardinality: "1:N",
    role: "서지정보",
  },
  {
    id: "author-book_author",
    constraint: "ref_book_author_author_id",
    from: "author",
    to: "book_author",
    fromColumn: "author_id",
    toColumn: "author_id",
    label: "author.author_id → book_author.author_id",
    cardinality: "1:N",
    role: "저자",
  },
  {
    id: "book-book_copy",
    constraint: "ref_book_copy_book_id",
    from: "book",
    to: "book_copy",
    fromColumn: "book_id",
    toColumn: "book_id",
    label: "book.book_id → book_copy.book_id",
    cardinality: "1:N",
    role: "서지정보 참조",
  },
  {
    id: "app_user-loan-member",
    constraint: "ref_loan_member_user_id",
    from: "app_user",
    to: "loan",
    fromColumn: "user_id",
    toColumn: "member_user_id",
    label: "app_user.user_id → loan.member_user_id",
    cardinality: "1:N · optional",
    role: "대출 시 MEMBER 필수, 탈퇴 후 NULL",
  },
  {
    id: "book_copy-loan",
    constraint: "ref_loan_copy_id",
    from: "book_copy",
    to: "loan",
    fromColumn: "copy_id",
    toColumn: "copy_id",
    label: "book_copy.copy_id → loan.copy_id",
    cardinality: "1:N",
    role: "대출된 실물 소장본",
  },
  {
    id: "app_user-loan-checkout",
    constraint: "ref_loan_checked_out_by_user_id",
    from: "app_user",
    to: "loan",
    fromColumn: "user_id",
    toColumn: "checked_out_by_user_id",
    label: "app_user.user_id → loan.checked_out_by_user_id",
    cardinality: "1:N",
    role: "대출 처리 사서",
  },
  {
    id: "app_user-loan-return",
    constraint: "ref_loan_returned_by_user_id",
    from: "app_user",
    to: "loan",
    fromColumn: "user_id",
    toColumn: "returned_by_user_id",
    label: "app_user.user_id → loan.returned_by_user_id",
    cardinality: "1:N · optional",
    role: "반납 처리 사서",
  },
  {
    id: "loan-loan_renewal",
    constraint: "ref_loan_renewal_loan_id",
    from: "loan",
    to: "loan_renewal",
    fromColumn: "loan_id",
    toColumn: "loan_id",
    label: "loan.loan_id → loan_renewal.loan_id",
    cardinality: "1:0..1",
    role: "대출당 최대 1회",
  },
  {
    id: "app_user-staff_account_history-target_staff_user_id",
    constraint: "ref_staff_account_history_target_staff_user_id",
    from: "app_user",
    to: "staff_account_history",
    fromColumn: "user_id",
    toColumn: "target_staff_user_id",
    label: "app_user.user_id → staff_account_history.target_staff_user_id",
    cardinality: "1:N",
    role: "대상 사서·관리자",
  },
  {
    id: "app_user-staff_account_history-processed_by_admin_user_id",
    constraint: "ref_staff_account_history_processed_by_admin_user_id",
    from: "app_user",
    to: "staff_account_history",
    fromColumn: "user_id",
    toColumn: "processed_by_admin_user_id",
    label:
      "app_user.user_id → staff_account_history.processed_by_admin_user_id",
    cardinality: "1:N · optional",
    role: "처리 관리자; 최초 시스템 생성 예외",
  },
  {
    id: "book-book_change_history-book_id",
    constraint: "ref_book_change_history_book_id",
    from: "book",
    to: "book_change_history",
    fromColumn: "book_id",
    toColumn: "book_id",
    label: "book.book_id → book_change_history.book_id",
    cardinality: "1:N",
    role: "변경 대상 도서",
  },
  {
    id: "app_user-book_change_history-changed_by_user_id",
    constraint: "ref_book_change_history_changed_by_user_id",
    from: "app_user",
    to: "book_change_history",
    fromColumn: "user_id",
    toColumn: "changed_by_user_id",
    label: "app_user.user_id → book_change_history.changed_by_user_id",
    cardinality: "1:N",
    role: "수정한 사서",
  },
  {
    id: "book_copy-copy_status_history-copy_id",
    constraint: "ref_copy_status_history_copy_id",
    from: "book_copy",
    to: "copy_status_history",
    fromColumn: "copy_id",
    toColumn: "copy_id",
    label: "book_copy.copy_id → copy_status_history.copy_id",
    cardinality: "1:N",
    role: "대상 소장본",
  },
  {
    id: "app_user-copy_status_history-changed_by_user_id",
    constraint: "ref_copy_status_history_changed_by_user_id",
    from: "app_user",
    to: "copy_status_history",
    fromColumn: "user_id",
    toColumn: "changed_by_user_id",
    label: "app_user.user_id → copy_status_history.changed_by_user_id",
    cardinality: "1:N",
    role: "처리 사서",
  },
  {
    id: "loan-copy_status_history-related_loan_id",
    constraint: "ref_copy_status_history_related_loan_id",
    from: "loan",
    to: "copy_status_history",
    fromColumn: "loan_id",
    toColumn: "related_loan_id",
    label: "loan.loan_id → copy_status_history.related_loan_id",
    cardinality: "1:N · optional",
    role: "반납 중 파손 확인 시 선택",
  },
  {
    id: "loan-loan_correction_history-loan_id",
    constraint: "ref_loan_correction_history_loan_id",
    from: "loan",
    to: "loan_correction_history",
    fromColumn: "loan_id",
    toColumn: "loan_id",
    label: "loan.loan_id → loan_correction_history.loan_id",
    cardinality: "1:N",
    role: "대상 대출",
  },
  {
    id: "app_user-loan_correction_history-corrected_by_user_id",
    constraint: "ref_loan_correction_history_corrected_by_user_id",
    from: "app_user",
    to: "loan_correction_history",
    fromColumn: "user_id",
    toColumn: "corrected_by_user_id",
    label: "app_user.user_id → loan_correction_history.corrected_by_user_id",
    cardinality: "1:N",
    role: "처리 사서",
  },
  {
    id: "app_user-request_record-actor_user_id",
    constraint: "ref_request_record_actor_user_id",
    from: "app_user",
    to: "request_record",
    fromColumn: "user_id",
    toColumn: "actor_user_id",
    label: "app_user.user_id → request_record.actor_user_id",
    cardinality: "1:N · optional",
    role: "요청자; 회원 탈퇴 시 연결 해제",
  },
  {
    id: "loan-request_record-target_loan_id",
    constraint: "ref_request_record_target_loan_id",
    from: "loan",
    to: "request_record",
    fromColumn: "loan_id",
    toColumn: "target_loan_id",
    label: "loan.loan_id → request_record.target_loan_id",
    cardinality: "1:N · optional",
    role: "관련 대출이 있을 때 참조",
  },
] as const;
export const dictionary = [
  {
    term: "사용자",
    english: "T-001",
    definition:
      "시스템에 계정이 존재하는 사람. 일반 회원, 사서, 관리자 세 역할로 구분한다.",
    table: "app_user",
    columns: "app_user / FR-01–FR-05",
  },
  {
    term: "일반 회원",
    english: "T-002",
    definition:
      "본인 계정으로 도서 검색·이력 조회·연장·탈퇴를 수행하고, 사서를 통해 실물 도서를 대출·반납하는 사용자.",
    table: "app_user",
    columns: "app_user.role = MEMBER / BP-01·03·08·10",
  },
  {
    term: "사서",
    english: "T-003",
    definition:
      "도서·소장본 관리, 대출·반납, 연체 현황 조회 및 대출·반납 정정을 수행하는 직원 역할.",
    table: "app_user",
    columns: "app_user.role = LIBRARIAN / BP-01·02·05–07·11",
  },
  {
    term: "관리자",
    english: "T-004",
    definition:
      "직원 계정 생성, 비활성화·재활성화, 계정·상태 이력 조회를 담당하는 직원 역할. 사서 업무 권한과 별개다.",
    table: "app_user",
    columns: "app_user.role = ADMIN / BP-04",
  },
  {
    term: "직원 업무 계정",
    english: "T-005",
    definition:
      "사서 또는 관리자 역할로 관리자가 생성하는 계정. 회원의 개인 대출에는 사용하지 않는다.",
    table: "app_user",
    columns: "app_user / BR-27–BR-29",
  },
  {
    term: "계정 역할",
    english: "T-006",
    definition:
      "계정 생성 시 부여하는 고정 권한 유형. 생성 후 역할 변경은 제공하지 않는다.",
    table: "app_user",
    columns: "app_user.role / BR-10·FR-05",
  },
  {
    term: "계정 상태",
    english: "T-007",
    definition:
      "계정의 이용 가능 또는 종료 상태. 회원과 직원에게 허용되는 상태 집합이 다르다.",
    table: "app_user",
    columns: "app_user.account_status / BR-27·FR-04",
  },
  {
    term: "활성 계정",
    english: "T-008",
    definition:
      "현재 계정 이용이 허용되는 상태인 계정. 본인정보 수정 등 인증 기능 사용의 전제다.",
    table: "app_user",
    columns: "app_user.account_status = ACTIVE / BP-03·09",
  },
  {
    term: "직원 계정 비활성화",
    english: "T-009",
    definition:
      "관리자가 직원 계정을 INACTIVE로 변경하여 로그인과 업무 접근을 차단하는 복구 가능한 조치.",
    table: "app_user",
    columns: "app_user.account_status / BP-04·09",
  },
  {
    term: "직원 계정 재활성화",
    english: "T-010",
    definition:
      "비활성 직원 계정을 관리자가 ACTIVE로 변경하여 다시 이용할 수 있게 하는 조치.",
    table: "staff_account_history",
    columns: "staff_account_history / BP-04",
  },
  {
    term: "회원 탈퇴",
    english: "T-011",
    definition:
      "미반납 대출이 없는 회원의 본인 요청으로 개인정보·인증정보를 제거하고 과거 개인 대출 연결을 해제하는 복구 불가능한 종료 처리.",
    table: "app_user",
    columns: "app_user.account_status = WITHDRAWN / FR-23·BP-03",
  },
  {
    term: "본인정보 수정",
    english: "T-012",
    definition:
      "사용자가 본인의 이름·연락처·비밀번호만 바꾸는 기능. 타인의 개인정보는 어느 역할도 수정할 수 없다.",
    table: "app_user",
    columns: "app_user / FR-03·BR-51",
  },
  {
    term: "로그인 식별자",
    english: "T-013",
    definition:
      "로그인 시 사용하는 계정 ID. 값이 남아 있는 모든 계정 사이에서 중복 금지한다.",
    table: "app_user",
    columns: "app_user.login_id / BR-50·BP-09",
  },
  {
    term: "내부 사용자 식별자",
    english: "T-014",
    definition:
      "시스템 내부에서 각 계정을 구별하는 ID. 로그인 식별자와 구별하며 직접 수정하지 못한다.",
    table: "app_user",
    columns: "app_user.user_id / 03-02",
  },
  {
    term: "연락처",
    english: "T-015",
    definition:
      "사용자가 입력하는 숫자 10–11자리 전화번호. 활성 회원 계정끼리만 중복 금지한다.",
    table: "app_user",
    columns: "app_user.contact / BR-25",
  },
  {
    term: "비밀번호 해시",
    english: "T-016",
    definition:
      "비밀번호 원문을 저장하지 않고 인증을 위해 저장하는 안전한 단방향 검증값.",
    table: "app_user",
    columns: "app_user.password_hash / NFR-08·BP-09",
  },
  {
    term: "최초 관리자",
    english: "T-017",
    definition:
      "시스템 초기 설정 시 만들어지는 첫 ADMIN 계정. 일반 관리자 생성 기능의 최초 예외다.",
    table: "app_user, staff_account_history",
    columns: "app_user / staff_account_history / BP-04·BR-29",
  },
  {
    term: "마지막 활성 관리자 보호",
    english: "T-018",
    definition:
      "시스템에 ACTIVE 상태 ADMIN이 최소 1명 남도록 마지막 관리자 비활성화를 금지하는 규칙.",
    table: "app_user",
    columns: "app_user / BR-29·BR-38",
  },
  {
    term: "도서 서지정보",
    english: "T-019",
    definition:
      "책의 제목·저자·분류 등 공통 서지정보. 개별 실물 소장본과 구별한다.",
    table: "book, book_author",
    columns: "book / book_author / BP-05",
  },
  {
    term: "도서 식별자",
    english: "T-020",
    definition: "ISBN 유무와 관계없이 각 서지정보를 고유하게 식별하는 내부 ID.",
    table: "book",
    columns: "book.book_id / BR-39",
  },
  {
    term: "저자",
    english: "T-021",
    definition:
      "서지정보에 연결되는 저작자 정보. 동명이인도 별도 식별자로 구분할 수 있다.",
    table: "author",
    columns: "author / BP-05·03-02",
  },
  {
    term: "도서–저자 연결",
    english: "T-022",
    definition:
      "도서와 저자 사이의 다대다(N:M) 관계. 도서마다 최소 1명 이상 연결한다.",
    table: "book_author",
    columns: "book_author / 03-01·03-02",
  },
  {
    term: "ISBN",
    english: "T-023",
    definition:
      "책의 국제표준도서번호. 선택 입력이지만 값이 있으면 유효성과 중복을 검사한다.",
    table: "book",
    columns: "book.isbn / BR-18·BR-40",
  },
  {
    term: "ISBN-10",
    english: "T-024",
    definition:
      "검증 후 ISBN-13으로 변환하여 입력·검색에 사용하는 10자리 ISBN 형식.",
    table: "book",
    columns: "book.isbn (입력 정규화) / BP-05",
  },
  {
    term: "ISBN-13",
    english: "T-025",
    definition: "내부 저장에 사용하는 하이픈 없는 13자리 ISBN 표준 형식.",
    table: "book",
    columns: "book.isbn / BP-05·03-03",
  },
  {
    term: "체크디지트",
    english: "T-026",
    definition: "ISBN 형식의 숫자 배열이 올바른지 확인하는 검증 숫자.",
    table: "book",
    columns: "book.isbn (입력 검증) / BP-05",
  },
  {
    term: "도서 분류 코드",
    english: "T-027",
    definition:
      "도서를 분야별로 검색하기 위한 필수 코드. 값 목록은 아직 확정하지 않았으며 별도 코드 도메인으로 관리한다.",
    table: "book",
    columns: "book.category_code / BR-36·03-02",
  },
  {
    term: "소장본",
    english: "T-028",
    definition:
      "도서관이 실제 보유한 책 한 권. 서지정보 하나에 0개 이상의 소장본이 속할 수 있다.",
    table: "book_copy",
    columns: "book_copy / BR-17",
  },
  {
    term: "소장본 식별자",
    english: "T-029",
    definition: "소장본 기록을 가리키는 내부 ID.",
    table: "book_copy",
    columns: "book_copy.copy_id / BP-06",
  },
  {
    term: "소장본 관리번호",
    english: "T-030",
    definition:
      "실물 책마다 시스템이 자동 발급하는 유일한 관리번호. 제적되어도 재사용하지 않는다.",
    table: "book_copy",
    columns: "book_copy.copy_code / BR-19",
  },
  {
    term: "소장본 관리 상태",
    english: "T-031",
    definition:
      "실물 소장본의 정상·파손·제적 여부. 대출 중인지 여부와 다른 개념이다.",
    table: "book_copy",
    columns: "book_copy.management_status / BR-20",
  },
  {
    term: "정상 소장본",
    english: "T-032",
    definition:
      "파손·제적되지 않은 ACTIVE 소장본. 대출 중이라면 대출 가능하지 않다.",
    table: "book_copy",
    columns: "book_copy.management_status = ACTIVE / BR-05",
  },
  {
    term: "파손 소장본",
    english: "T-033",
    definition: "수리 또는 제적 전까지 신규 대출할 수 없는 DAMAGED 소장본.",
    table: "book_copy",
    columns: "book_copy.management_status = DAMAGED / BR-21",
  },
  {
    term: "제적 소장본",
    english: "T-034",
    definition:
      "도서관 실물 운영 대상에서 제외한 RETIRED 소장본. 이력은 유지하고 상태를 되돌리지 않는다.",
    table: "book_copy",
    columns: "book_copy.management_status = RETIRED / BR-23",
  },
  {
    term: "일반 도서 검색 노출",
    english: "T-035",
    definition:
      "ACTIVE 또는 DAMAGED 소장본을 1권 이상 가진 도서만 회원·관리자 검색에 나타나는 기준.",
    table: "book, book_copy",
    columns: "book + book_copy (유도) / BR-24",
  },
  {
    term: "대출 가능 소장본",
    english: "T-036",
    definition:
      "ACTIVE이며 유효한 미반납 LOAN이 없는 소장본. 별도 가능 여부 플래그는 저장하지 않는다.",
    table: "book_copy, loan",
    columns: "book_copy + loan (유도) / BR-05",
  },
  {
    term: "대출",
    english: "T-037",
    definition:
      "회원이 사서를 통해 특정 소장본을 빌리는 사건. 해당 소장본별로 대출 기록을 생성한다.",
    table: "loan",
    columns: "loan / FR-12·BP-01",
  },
  {
    term: "대출 처리 사서",
    english: "T-038",
    definition:
      "실물 대출을 시스템에 기록한 LIBRARIAN. 개인 대출 회원과 구별한다.",
    table: "loan",
    columns: "loan.checked_out_by_user_id / BP-01",
  },
  {
    term: "반납",
    english: "T-039",
    definition:
      "사서가 실물 소장본을 확인하고 기존 대출의 유효 반납 정보를 기록하는 업무.",
    table: "loan",
    columns: "loan.returned_at / FR-13·BP-02",
  },
  {
    term: "반납 처리 사서",
    english: "T-040",
    definition:
      "대출의 반납을 시스템에 확정한 LIBRARIAN. 대출 처리 사서와 다를 수 있다.",
    table: "loan",
    columns: "loan.returned_by_user_id / BP-02",
  },
  {
    term: "대출 일시",
    english: "T-041",
    definition:
      "대출을 시스템에 확정한 실제 시점. 날짜 판정은 Asia/Seoul 기준이다.",
    table: "loan",
    columns: "loan.borrowed_at / BR-02",
  },
  {
    term: "최초 반납예정일",
    english: "T-042",
    definition:
      "기본 14일 규칙에 따라 대출 생성 시 처음 확정한 반납 기한 날짜.",
    table: "loan",
    columns: "loan.initial_due_date / BR-02",
  },
  {
    term: "현재 반납예정일",
    english: "T-043",
    definition:
      "허용된 1회 연장과 기록 오류 정정을 반영한 현재 유효한 반납 기한 날짜.",
    table: "loan",
    columns: "loan.current_due_date / BR-12·BP-11",
  },
  {
    term: "실제 반납일시",
    english: "T-044",
    definition: "실제 반납 완료로 확정된 시점. 미반납이면 현재 유효 값이 없다.",
    table: "loan",
    columns: "loan.returned_at / BR-06",
  },
  {
    term: "유효한 미반납 대출",
    english: "T-045",
    definition:
      "대출 취소 상태가 아니고 아직 반납 완료되지 않은 대출. 권수·점유·연체 계산 기준.",
    table: "loan",
    columns: "loan.is_cancelled + loan.returned_at / BR-03·BR-05",
  },
  {
    term: "현재 대출 권수",
    english: "T-046",
    definition: "회원에게 연결된 유효한 미반납 대출의 수. 최대 5건이다.",
    table: "loan",
    columns: "loan (유도) / BR-03",
  },
  {
    term: "대출 취소",
    english: "T-047",
    definition:
      "잘못된 대출의 효력을 없애되 기록 자체는 보존하는 정정. 실물이 반출되어 있다면 회수·확인 없이 취소할 수 없다.",
    table: "loan, loan_correction_history",
    columns: "loan.is_cancelled / loan_correction_history / BR-43·BP-11",
  },
  {
    term: "대출 연장",
    english: "T-048",
    definition:
      "회원이 본인의 유효한 미반납 대출에 대해 기존 기한에서 7일을 더하는 행위. 대출 건당 최대 1회다.",
    table: "loan, loan_renewal",
    columns: "loan_renewal + loan.current_due_date / BR-11–BR-14",
  },
  {
    term: "연장 이력",
    english: "T-049",
    definition:
      "성공한 연장의 시점과 변경 전후 기한을 기록한 사건. 신규 LOAN이 아니다.",
    table: "loan_renewal",
    columns: "loan_renewal / FR-14",
  },
  {
    term: "연장 횟수",
    english: "T-050",
    definition:
      "대출당 성공한 LOAN_RENEWAL 기록의 개수. 현재 최대 1건이며 독립 속성으로 중복 저장하지 않는다.",
    table: "loan_renewal",
    columns: "loan_renewal (유도) / BR-11",
  },
  {
    term: "반납 취소",
    english: "T-051",
    definition:
      "실제로는 반납되지 않은 도서를 잘못 반납 완료한 경우, 충돌이 없을 때 미반납 상태로 복원하는 정정.",
    table: "loan_correction_history",
    columns: "loan_correction_history / BR-44–BR-45",
  },
  {
    term: "대출·반납 정정",
    english: "T-052",
    definition:
      "잘못된 대출 취소, 오반납 복원, 허용된 기한·반납일시 오류 수정을 포함하는 사서 업무.",
    table: "loan_correction_history",
    columns: "loan_correction_history / FR-22·BP-11",
  },
  {
    term: "현재 연체",
    english: "T-053",
    definition:
      "유효한 미반납 대출의 최종 반납예정일이 오늘(KST)보다 이전인 상태. 반납예정일 당일은 연체가 아니다.",
    table: "loan",
    columns: "loan (유도) / BR-07",
  },
  {
    term: "과거 연체",
    english: "T-054",
    definition:
      "반납 완료된 대출의 실제 반납 날짜가 최종 반납예정일보다 늦었던 사실.",
    table: "loan",
    columns: "loan (유도) / BR-08",
  },
  {
    term: "연체 일수",
    english: "T-055",
    definition:
      "KST의 실제 반납 날짜(미반납이면 오늘)와 최종 반납예정일의 날짜 차이를 0 이상으로 계산한 값.",
    table: "loan",
    columns: "loan (유도) / BR-07–BR-08",
  },
  {
    term: "현재 연체 제한",
    english: "T-056",
    definition:
      "미반납 연체가 한 건이라도 있을 때 신규 대출과 모든 대출 연장을 막는 규칙.",
    table: "loan",
    columns: "loan (유도) / BR-04·BR-14",
  },
  {
    term: "반납 후 신규 대출 정지",
    english: "T-057",
    definition:
      "연체 도서 반납 후 연체 날짜 수만큼 실제 반납 시점부터 신규 대출만 금지하는 별도 제한.",
    table: "app_user",
    columns: "app_user.borrowing_suspended_until / BR-52",
  },
  {
    term: "신규 대출 정지 종료시각",
    english: "T-058",
    definition:
      "각 연체 반납의 실제 반납시각에 연체 일수×24시간을 더한 종료시각 중 가장 늦은 시각.",
    table: "app_user",
    columns: "app_user.borrowing_suspended_until / BR-52",
  },
  {
    term: "정지 종료시각 재계산",
    english: "T-059",
    definition:
      "반납·반납예정일·정정·취소가 발생하면 현재 유효한 연체 반납을 기준으로 종료시각을 다시 산정하는 작업.",
    table: "app_user, loan",
    columns: "loan + app_user / BR-52·BP-07·11",
  },
  {
    term: "직원 계정 변경 이력",
    english: "T-060",
    definition:
      "직원 계정 생성·비활성화·재활성화의 사유·처리자·시각을 보존하는 기록. 역할 변경 이력은 없다.",
    table: "staff_account_history",
    columns: "staff_account_history / BR-30–BR-32",
  },
  {
    term: "도서 서지 변경 이력",
    english: "T-061",
    definition:
      "서지정보 또는 저자 연결의 수정 전후 내용과 처리 사서를 보존하는 기록.",
    table: "book_change_history",
    columns: "book_change_history / FR-20",
  },
  {
    term: "소장본 상태 변경 이력",
    english: "T-062",
    definition:
      "파손·수리·제적에 관한 이전 상태, 새 상태, 변경 사유·처리자·시각을 저장하는 기록.",
    table: "copy_status_history",
    columns: "copy_status_history / BR-31",
  },
  {
    term: "대출 정정 이력",
    english: "T-063",
    definition:
      "대출 취소·반납 복원·날짜 오류 정정의 전후 사실과 사유·처리자·시각을 보존하는 기록.",
    table: "loan_correction_history",
    columns: "loan_correction_history / BR-42–BR-45",
  },
  {
    term: "감사 스냅샷",
    english: "T-064",
    definition:
      "업무 변경 당시 전후 상태를 남기는 구조화 기록. 회원 이름·전화번호·로그인 ID·탈퇴 회원 연결 정보는 저장하지 않는다.",
    table: "book_change_history, loan_correction_history",
    columns: "book_change_history / loan_correction_history / NFR-18–NFR-20",
  },
  {
    term: "요청 식별자",
    english: "T-065",
    definition:
      "동일한 업무 요청의 재전송을 구분하는 중복되지 않는 UUID. 개인 식별값을 포함하지 않는다.",
    table: "request_record",
    columns: "request_record.request_id / FR-21",
  },
  {
    term: "요청 지문",
    english: "T-066",
    definition:
      "동일 요청 ID가 동일 업무 내용인지 판별하는 비식별 요청 내용의 지문. 개인정보·회원 식별자 직접 포함 금지.",
    table: "request_record",
    columns: "request_record.request_fingerprint / BR-37",
  },
  {
    term: "요청 처리 상태",
    english: "T-067",
    definition:
      "업무 요청이 처리 중인지, 완료됐는지, 실패했는지를 나타내는 상태.",
    table: "request_record",
    columns: "request_record.processing_status / 03-02·03-03",
  },
  {
    term: "멱등성",
    english: "T-068",
    definition:
      "동일 요청을 재전송해도 실제 데이터 변경은 한 번만 일어나고 기존 결과를 돌려주는 성질.",
    table: "request_record",
    columns: "request_record / FR-21·BR-37",
  },
  {
    term: "업무 트랜잭션",
    english: "T-069",
    definition:
      "상태 변경과 이력 기록 등 여러 DB 변경을 모두 성공하거나 모두 취소하도록 묶은 처리 단위.",
    table: "",
    columns: "복수 테이블 / NFR-05",
  },
  {
    term: "동시성 제어",
    english: "T-070",
    definition:
      "여러 사용자의 요청이 겹쳐도 회원당 5권, 소장본 중복 대출 금지, 마지막 관리자 보호가 유지되게 하는 검증·잠금.",
    table: "app_user, loan",
    columns: "loan / app_user / NFR-06·BR-38",
  },
  {
    term: "식별 연결 해제",
    english: "T-071",
    definition:
      "회원 탈퇴 후 대출과 연계 이력에서 특정 회원을 가리키는 링크를 제거하는 처리.",
    table: "loan, request_record",
    columns: "loan.member_user_id / request_record.actor_user_id / BR-47–BR-48",
  },
  {
    term: "비식별 이용 이력",
    english: "T-072",
    definition:
      "탈퇴 회원의 신원이나 개인별 독서 이력을 복원할 수 없도록 연결을 없애고 소장본별 업무 사실만 보존한 기록.",
    table: "loan, loan_renewal",
    columns: "loan / loan_renewal / correction history / FR-23",
  },
  {
    term: "표준시(KST)",
    english: "T-073",
    definition:
      "모든 업무 날짜 계산의 기준이 되는 한국 표준시(Asia/Seoul). DB TIMESTAMPTZ의 표시 시점과 날짜 계산을 구분한다.",
    table: "",
    columns: "borrowed_at / returned_at / due dates / BR-02·BR-52",
  },
];
