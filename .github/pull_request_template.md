## Summary

- What changed:
- Why:

## TDD Checklist

- [ ] I wrote/updated tests first (or in the same PR) for the new behavior.
- [ ] `npm run test` passes locally.
- [ ] `npm run test:coverage` passes locally.
- [ ] API changes are covered by backend contract tests (`apps/backend/tests/app.test.ts`).
- [ ] UI/domain logic changes are covered by frontend unit/component tests.
- [ ] TR/EN locale keys remain in parity (`apps/frontend/src/locales/index.test.ts`).
- [ ] I updated docs if behavior/contracts changed.

## Risk Check

- [ ] This PR changes DB schema/migrations.
- [ ] This PR changes API response shape.
- [ ] This PR changes auth/session behavior.
- [ ] This PR changes streaming behavior.

## Verification Notes

- Commands run:
  - ``
- Key outputs:
  - ``
