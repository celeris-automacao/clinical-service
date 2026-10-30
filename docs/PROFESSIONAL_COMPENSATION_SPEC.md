# Professional compensation: initial functional model

**Status:** specification only. This document does not define payable amounts,
run calculations, or change the database.

## Proposed model boundaries

Compensation should be a separate domain from the professional's patient-facing
private consultation price. A compensation agreement should be scoped to a
clinic and professional, and include:

- compensation type: fixed, variable, or commission;
- effective start and optional end date;
- agreed value/rate and currency;
- applicable service or revenue basis for variable/commission agreements;
- status, author, creation time, and change history;
- explicit rule for which version applies to a service delivered on an
  agreement boundary date.

Terms should be versioned rather than overwritten. Any future payout record
should retain a reference to the agreement version and the source transaction
used in its calculation. Access should be restricted to clinic owners/admins
and authorized finance roles; professionals may see only their own approved
terms unless a product decision says otherwise.

## Decisions required before implementation

1. Define whether fixed compensation is per month, period, or service.
2. Define commission basis (gross/net, discounts, refunds, taxes, and payment
   fees) and rounding rules.
3. Define when variable compensation is earned and how cancellations/refunds
   affect it.
4. Define currency, time zone, payment calendar, approval workflow, and
   retroactive-edit policy.
5. Confirm finance roles, visibility, audit retention, and report/export needs.
6. Define whether agreements may overlap and how date-boundary changes are
   resolved.

No compensation schema or calculation should be shipped until these decisions
are approved. The existing private consultation price is not an employee
compensation rate.
