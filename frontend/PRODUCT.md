# Product

## Platform

web

## Purpose and users

책담 V2 demonstrates library workflows against the latest Wiki's twelve-table relational model. Members search and renew their own loans and manage their own account. Librarians maintain catalog/copies and process checkout, return and corrections. Administrators manage staff accounts and inspect nonidentifying aggregate statistics and schema metadata.

## Product truth

The source is Wiki commit 9e698003329b281ef36efea19fe48e2f0c0eaa8e, not the legacy seven-table database/schema.sql. Policies include five active loans per member, one active loan per copy, KST fourteen-day checkout and one seven-day renewal. Cancelled loans do not occupy copies or count toward limits. Current overdue and post-return suspension are separate restrictions.

## Boundaries

All data is synthetic and shared in a browser-only versioned Zustand Mock store. Role selection is a demonstration, not authentication. No API, backend, actual SQL, PostgreSQL transaction or production security is implemented. DB Flow clearly labels simulated operations and SQL examples. Unknown policies use documented safe restrictions; see docs/V2-IMPLEMENTATION.md.

## Design and accessibility

Preserve the established white/neutral/navy identity and navigation. Apply OpenDesign Cloud layout and token references to functioning React surfaces. Prioritize readable tables, correct relational information, clear errors, keyboard operation, responsive layouts and reduced motion. Never expose password hashes or patron identity through DB Console or audit snapshots.
