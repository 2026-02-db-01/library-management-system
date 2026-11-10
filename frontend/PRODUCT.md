# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Members search the catalog, inspect copy availability, review loan history, and renew their own eligible loan.
- Librarians verify a member and a physical copy before recording checkout or return work.
- Administrators maintain users and catalog data, review aggregate activity, and explore the schema.
- Students and reviewers use the same application as a role-based library administration demo.

## Product Purpose

Show how everyday library work maps to a relational data model. Success means users can complete the mock member, librarian, and administrator workflows and inspect the tables, columns, foreign keys, and simulated database events involved.

## Positioning

The DB Flow Inspector links a selected workflow step to the real schema relationships and explains its SELECT, INSERT, UPDATE, COMMIT, or ROLLBACK event. It is an educational simulation and never claims to execute SQL or move data through PostgreSQL.

## Operating Context

The app is a browser-only demo backed by one shared mock data store. Users choose a role without a password. Librarians handle in-person checkouts; members do not create checkout requests or loan records themselves. Administrators can inspect a read-only schema catalog.

## Capabilities and Constraints

- The physical model is the seven-table PostgreSQL schema in `../database/schema.sql`; the repository Wiki defines BR-01–16 and FR-01–16.
- Loan periods are 14 days, one active loan per member and copy, and one non-overdue renewal of seven days.
- A return preserves the loan and records both return fields. Copy availability is derived from active loan rows, not `book_copy.management_status`.
- Renewal changes the loan due date and adds its history together in mock state. The failure demonstration restores both values.
- Role selection and route guards are frontend demo behavior, not authentication or security.
- No API, backend, PostgreSQL connection, authentication server, Docker change, SQL execution, or real transaction is part of this stage.

## Brand Commitments

The existing product name is 책담. The user brief requires an administrative, restrained interface using white, neutral gray, and deep navy, with green, blue, orange, and red reserved for database operation meaning.

## Evidence on Hand

- `../database/schema.sql` is the physical schema source of truth.
- Mock records in `src/data/mock/seed.ts` are synthetic demo data.
- Existing React screens, assets, and `DESIGN.md` define the incumbent UI and reusable components.
- No production API, real patron data, or live database is connected.

## Product Principles

- Keep business actions and their database effects understandable together.
- Preserve historical records and derive availability and overdue status from loan data.
- Share one consistent mock state across member, librarian, and administrator screens.
- Make demo behavior and access limits explicit.
- Support keyboard use, compact layouts, and reduced motion.

## Accessibility & Inclusion

Keyboard navigation and visible focus are required. The inspector must adapt to narrow screens and replace moving animation with static step highlighting when reduced motion is preferred.
