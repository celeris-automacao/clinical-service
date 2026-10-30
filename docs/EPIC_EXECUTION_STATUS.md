# Epic execution status

**Verification date:** 2026-10-15  
**Backlog Master:** not present in the workspace; this is a local evidence
summary, not an update to the official backlog. No push or deployment was made.

| Epic / item | Status in this workspace | Evidence or remaining work |
|---|---|---|
| PROFESSIONAL-PRICE-AUTHZ-001 | Implemented in source | Professional price screen is read-only. API authorization tests assert own-context read and reject price updates. |
| WEB-CURRENCY-FORMAT-001 | Partial | BRL formatter and unit tests exist. Confirm that every financial field across the product uses it. |
| WEB-DEPLOY-CACHE-POLICY-001 | Policy file added; deployment validation pending | `web/_headers` sets revalidation rules for the Flutter shell/runtime. No hosting provider or release pipeline is available here to verify deployed response headers. |
| PROFESSIONAL-COMPENSATION-001 | Specification only | See `PROFESSIONAL_COMPENSATION_SPEC.md`. Calculation rules and database implementation remain intentionally out of scope pending product decisions. |
| Epic 01 — uploads | Not implemented | No API/storage integration or reusable upload flow was found. Supabase Storage credentials and bucket/policy provisioning are still required. |
| Epic 02 — error messages | Partial | `ErrorCatalog` is wired into authentication. Other screens still render raw exception values and must be migrated before this epic is complete. |
| Epic 03 — password | Not implemented | No password-change/recovery API or UI flow was found. Current Flutter Supabase URL/key are placeholders, so a working authenticated recovery flow cannot be exercised. |
| Epics 04–06 — contacts, CPF, birth date | Implemented locally; migration applied to local DB only | API and Flutter validation, normalization, no-login contact creation, date-only conversion, and tests are present. Valid CPF uniqueness is clinic-scoped, while invalid legacy values are preserved. See `PATIENT_CONTACT_VALIDATION.md`. |
| Epics 07–08 — appointments, payments, receipts | Not implemented | No appointment/payment/financial-entry model exists to enforce scheduling conflicts, clinic payment configuration, payment status/history, or receipt association. Avoid accepting receipts with a fabricated or unverifiable relationship. |
| Epic 09 — activity details | Not implemented | The current social activity/feed domain has no verified detail route linking each event to its source record. |
| Epic 10 — comment/photo moderation | Not implemented | No comment/photo moderation domain or ownership/audit flow was found. |
| Epic 11 — sales contact | Not implemented | No admin-configurable channel model or management flow was found. |
| Epic 12 — terminology | No matching “Vagas” copy found in the inspected frontend/backend source | A centralized replacement constant is not present; confirm against translation/content sources outside these source trees. |
| Epic 14 — compensation architecture | Specification only | See `PROFESSIONAL_COMPENSATION_SPEC.md`; no financial calculations or schema were introduced. |

The workspace also contains unrelated, pre-existing uncommitted changes.
Nothing in this status report authorizes discarding them, applying migrations,
or changing a production/staging environment.
