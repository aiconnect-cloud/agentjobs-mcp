---
description: Run the security gate before pushing (secrets, deps, project checks).
---

Prerequisites (one-time):
- `gitleaks` — install with `brew install gitleaks` (macOS) or `go install github.com/gitleaks/gitleaks/v8@latest`.
- `npm` is already required by the repo.

Run the steps below in order. Stop at the first failure and resolve it before continuing.

1. **Scan for leaked secrets** (working tree + git history):
   ```bash
   gitleaks detect --redact --no-banner
   ```
   If a match is a confirmed false positive (e.g. a fixture in `docs/` or a test sample), add it to `.gitleaksignore` — do not disable the scan. Real findings: rotate the credential, then purge it from history before pushing.

2. **Audit npm dependencies** for high/critical CVEs:
   ```bash
   npm audit --audit-level=high
   ```
   Fix with `npm audit fix`, or pin/replace the offending package. If a finding is dev-only and accepted, note it in the PR description with the rationale.

3. **Run project checks** (the same gates documented in `CLAUDE.md`):
   ```bash
   npm run typecheck
   npm run lint
   npm test -- --run
   ```
   `--run` forces Vitest into single-run mode (the default `npm test` watches).

4. After a clean pass on all three steps, proceed with commit and push.

Do not bypass this gate with `git commit --no-verify` or by silencing findings.
