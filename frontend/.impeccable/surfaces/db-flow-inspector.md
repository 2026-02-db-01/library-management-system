# DB Flow Inspector surface

## Mode

Operate

## Audience and task

Members, librarians, administrators, and reviewers use a role-based library workflow. The inspector helps them see which schema tables and real foreign-key relationships a selected task step concerns.

## Success

The user can complete the library action in the work pane, follow its related table and column highlights in the React Flow pane, inspect the moving relationship marker and SQL-operation timeline, and understand that every database event is simulated.

## Required states

- Closed: ordinary workflow remains usable and its state is preserved when the inspector is opened again.
- Active: resizable 55/45 work and ERD panes, with event history along the bottom.
- Mobile: switch between work and ERD tabs instead of forcing a split.
- Success and failure: show the affected fields, the result, and COMMIT or ROLLBACK.
- Reduced motion: show the selected step statically without a moving marker.
- Role boundary: redirect to the role selection page when a route does not match the selected demo role.

## Constraints

Inherit the existing white, neutral gray, and deep navy design system. Use operation colors only to explain SELECT, INSERT, UPDATE, COMMIT, and ROLLBACK. Use only the seven tables and foreign keys in `../database/schema.sql`; never draw a business-only lookup as an FK. Keep all actions in the shared mock store and never describe them as real SQL or PostgreSQL transactions.

## Target viewports

1440x900, 768x1024, 390x844
