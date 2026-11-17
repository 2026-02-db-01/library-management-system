import fs from "node:fs";
import { format } from "prettier";
const source = fs.readFileSync("docs/wiki/physical-model.md", "utf8"),
  tables = {};
for (const block of source.split(/^### /m).slice(1)) {
  const heading = block.match(/^3\.\d+ `([^`]+)` — (.+)/);
  if (!heading) continue;
  const [, name, label] = heading,
    columns = [],
    constraints = [],
    indexes = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);
    if (!m) continue;
    const [, col, domain, rules, purpose] = m,
      ref = rules.match(/FK → `([^`]+)`/),
      type = domain.split("/")[0].trim();
    const reference = ref
      ? `${ref[1]}.${{ app_user: "user_id", book: "book_id", author: "author_id", book_copy: "copy_id", loan: "loan_id" }[ref[1]]}`
      : undefined;
    columns.push({
      name: col,
      type,
      nullable: domain.includes("/ NULL"),
      description: purpose.trim(),
      ...(reference
        ? { key: "FK", reference }
        : rules.includes("PK")
          ? { key: "PK" }
          : rules.includes("UK")
            ? { key: "UNIQUE" }
            : {}),
      ...(rules.includes("기본 ")
        ? { defaultValue: rules.split("기본 ")[1].split(",")[0] }
        : {}),
    });
    if (reference)
      constraints.push({
        name: `ref_${name}_${col}`,
        kind: "FOREIGN KEY",
        columns: [col],
        definition: `FOREIGN KEY (${col}) REFERENCES ${reference.replace(".", "(")})`,
        purpose: purpose.trim(),
        reference,
      });
    if (rules.includes("UK"))
      constraints.push({
        name: `unique_${name}_${col}`,
        kind: "UNIQUE",
        columns: [col],
        definition: `UNIQUE (${col})`,
        purpose: rules.trim(),
      });
  }
  const pk =
    name === "book_author"
      ? ["book_id", "author_id"]
      : columns.filter((c) => c.key === "PK").map((c) => c.name);
  constraints.unshift({
    name: `pk_${name}`,
    kind: "PRIMARY KEY",
    columns: pk,
    definition: `PRIMARY KEY (${pk.join(", ")})`,
    purpose: "고유 식별",
  });
  tables[name] = {
    name,
    label,
    description: `${label} · Wiki 물리 모델`,
    columns,
    constraints,
    indexes,
  };
}
const checks = {
  app_user: [
    "role IN ('MEMBER','LIBRARIAN','ADMIN')",
    "(role = 'MEMBER' AND account_status IN ('ACTIVE','WITHDRAWN')) OR (role IN ('LIBRARIAN','ADMIN') AND account_status IN ('ACTIVE','INACTIVE'))",
    "contact IS NULL OR contact ~ '^[0-9]{10,11}$'",
    "(account_status = 'WITHDRAWN' AND login_id IS NULL AND password_hash IS NULL AND full_name IS NULL AND contact IS NULL AND borrowing_suspended_until IS NULL) OR (account_status <> 'WITHDRAWN' AND login_id IS NOT NULL AND password_hash IS NOT NULL AND full_name IS NOT NULL AND contact IS NOT NULL)",
  ],
  book: [
    "length(trim(title)) > 0",
    "publisher IS NULL OR length(trim(publisher)) > 0",
    "publication_year IS NULL OR publication_year BETWEEN 1 AND 9999",
    "isbn IS NULL OR isbn ~ '^[0-9]{13}$'",
    "category_code ~ '^[A-Z][A-Z0-9_]{0,31}$'",
  ],
  author: ["length(trim(author_name)) > 0"],
  book_copy: [
    "management_status IN ('ACTIVE','DAMAGED','RETIRED')",
    "length(trim(copy_code)) > 0",
  ],
  loan: [
    "current_due_date >= initial_due_date",
    "(returned_at IS NULL) = (returned_by_user_id IS NULL)",
    "returned_at IS NULL OR returned_at >= borrowed_at",
    "is_cancelled = (cancelled_at IS NOT NULL)",
  ],
  loan_renewal: ["new_due_date = previous_due_date + 7"],
  staff_account_history: [
    "action_type IN ('CREATE','DEACTIVATE','REACTIVATE')",
    "new_status IN ('ACTIVE','INACTIVE')",
    "(action_type = 'CREATE' AND previous_status IS NULL AND new_status = 'ACTIVE' AND role_at_creation IN ('LIBRARIAN','ADMIN')) OR (action_type IN ('DEACTIVATE','REACTIVATE') AND previous_status IS NOT NULL AND role_at_creation IS NULL AND length(trim(reason)) > 0 AND processed_by_admin_user_id IS NOT NULL)",
  ],
  book_change_history: [
    "jsonb_typeof(before_values) = 'object' AND jsonb_typeof(after_values) = 'object'",
  ],
  copy_status_history: [
    "new_status IN ('ACTIVE','DAMAGED','RETIRED')",
    "previous_status IS NULL OR previous_status IN ('ACTIVE','DAMAGED','RETIRED')",
    "length(trim(reason)) > 0",
  ],
  loan_correction_history: [
    "correction_type IN ('CANCEL_LOAN','UNDO_RETURN','CORRECT_DUE_DATE','CORRECT_RETURNED_AT')",
    "length(trim(reason)) > 0",
    "jsonb_typeof(before_values) = 'object' AND jsonb_typeof(after_values) = 'object'",
  ],
  request_record: [
    "operation_type IN ('CHECKOUT','RETURN','RENEW','CORRECT')",
    "request_fingerprint ~ '^[0-9a-f]{64}$'",
    "processing_status IN ('PENDING','COMPLETED','FAILED')",
    "(processing_status = 'PENDING' AND completed_at IS NULL) OR (processing_status IN ('COMPLETED','FAILED') AND completed_at IS NOT NULL AND result_code IS NOT NULL)",
    "response_snapshot IS NULL OR jsonb_typeof(response_snapshot) = 'object'",
  ],
};
for (const [name, defs] of Object.entries(checks))
  defs.forEach((def, i) =>
    tables[name].constraints.push({
      name: `example_check_${name}_${i + 1}`,
      kind: "CHECK",
      columns: tables[name].columns
        .filter((c) => def.includes(c.name))
        .map((c) => c.name),
      definition: `CHECK (${def})`,
      purpose: "Wiki 제약 의미 SQL 예시 · 원본 DDL 제약명 미확보",
    }),
  );
const index = (table, name, cols, where = "", unique = false) =>
  tables[table].indexes.push({
    name,
    definition: `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table} (${cols})${where ? " WHERE " + where : ""}`,
    unique,
    partial: !!where,
    purpose: "Wiki 무결성·조회 인덱스",
  });
index(
  "app_user",
  "uq_app_user_active_member_contact",
  "contact",
  "role = 'MEMBER' AND account_status = 'ACTIVE'",
  true,
);
index(
  "loan",
  "uq_loan_valid_unreturned_copy",
  "copy_id",
  "is_cancelled = FALSE AND returned_at IS NULL",
  true,
);
for (const row of [
  ["book_author", "idx_book_author_author", "author_id"],
  ["book_copy", "idx_book_copy_book_status", "book_id, management_status"],
  [
    "loan",
    "idx_loan_member_history",
    "member_user_id, borrowed_at DESC",
    "member_user_id IS NOT NULL",
  ],
  ["loan", "idx_loan_copy_history", "copy_id, borrowed_at DESC"],
  [
    "loan",
    "idx_loan_active_member_due",
    "member_user_id, current_due_date",
    "is_cancelled = FALSE AND returned_at IS NULL",
  ],
  [
    "loan",
    "idx_loan_active_due",
    "current_due_date",
    "is_cancelled = FALSE AND returned_at IS NULL",
  ],
  ["loan", "idx_loan_checkout_staff", "checked_out_by_user_id"],
  ["loan", "idx_loan_return_staff", "returned_by_user_id"],
  [
    "staff_account_history",
    "idx_staff_history_target",
    "target_staff_user_id, processed_at DESC",
  ],
  ["book_change_history", "idx_book_change_target", "book_id, changed_at DESC"],
  ["copy_status_history", "idx_copy_status_target", "copy_id, changed_at DESC"],
  [
    "loan_correction_history",
    "idx_correction_target",
    "loan_id, corrected_at DESC",
  ],
  ["request_record", "idx_request_target_loan", "target_loan_id"],
])
  index(...row);
const special = {
  book_author: { book_id: "book-book_author", author_id: "author-book_author" },
  book_copy: { book_id: "book-book_copy" },
  loan: {
    copy_id: "book_copy-loan",
    member_user_id: "app_user-loan-member",
    checked_out_by_user_id: "app_user-loan-checkout",
    returned_by_user_id: "app_user-loan-return",
  },
  loan_renewal: { loan_id: "loan-loan_renewal" },
};
const relationships = Object.values(tables).flatMap((t) =>
  t.columns
    .filter((c) => c.key === "FK")
    .map((c) => {
      const [from, fromColumn] = c.reference.split(".");
      return {
        id: special[t.name]?.[c.name] ?? `${from}-${t.name}-${c.name}`,
        constraint: `ref_${t.name}_${c.name}`,
        from,
        to: t.name,
        fromColumn,
        toColumn: c.name,
        label: `${c.reference} → ${t.name}.${c.name}`,
        cardinality:
          t.name === "loan_renewal"
            ? "1:0..1"
            : c.nullable
              ? "1:N · optional"
              : "1:N",
        role: c.description,
      };
    }),
);
const dictionary = fs
  .readFileSync("docs/wiki/dictionary.md", "utf8")
  .split("\n")
  .flatMap((line) => {
    const m = line.match(
      /^\| T-(\d+) \| \*\*([^*]+)\*\* \| ([^|]+) \| ([^|]+) \|/,
    );
    if (!m) return [];
    const [, id, term, definition, related] = m;
    const names = Object.keys(tables).filter((name) =>
      new RegExp(`\\b${name}\\b`, "i").test(related),
    );
    return [
      {
        term,
        english: `T-${id}`,
        definition: definition.replaceAll("**", "").trim(),
        table: names.join(", "),
        columns: related.replaceAll("`", "").trim(),
      },
    ];
  });
const types = `export type TableName = ${Object.keys(tables)
  .map((n) => `'${n}'`)
  .join(
    " | ",
  )}\nexport type ConstraintKind = 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK'\nexport interface ColumnMetadata {name:string;type:string;nullable:boolean;defaultValue?:string;key?:'PK'|'FK'|'UNIQUE';reference?:string;description:string}\nexport interface ConstraintMetadata {name:string;kind:ConstraintKind;columns:string[];definition:string;purpose:string;reference?:string}\nexport interface IndexMetadata {name:string;definition:string;unique:boolean;partial:boolean;purpose:string}\nexport interface TableMetadata {name:TableName;label:string;description:string;columns:ColumnMetadata[];constraints:ConstraintMetadata[];indexes:IndexMetadata[]}\n`;
fs.writeFileSync(
  "src/data/metadata/schema.ts",
  await format(
    types +
      `export const tableOrder:TableName[] = ${JSON.stringify(Object.keys(tables))}\nexport const tableMetadata:Record<TableName,TableMetadata> = ${JSON.stringify(tables, null, 2)}\nexport const relationships = ${JSON.stringify(relationships, null, 2)} as const\nexport const dictionary = ${JSON.stringify(dictionary, null, 2)}\n`,
    { parser: "typescript" },
  ),
);
