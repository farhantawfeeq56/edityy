<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — edityy

The working agreement for every AI agent (and human) contributing to **edityy**.

**Agents do not share memory. GitHub Issues, Git history, and PR threads are shared memory.** If
it isn't written there, a future session doesn't know it happened.

---

## 0. Team & tooling

| Item | Value |
|---|---|
| Repo | `farhantawfeeq56/edityy` (**public** — unauthenticated API calls return 200) |
| Default branch | `main` |
| Issue tracker | GitHub Issues on this repo |
| Owner | Farhan Tawfeeq — `@farhantawfeeq56` (admin) |
| Contributor | Aathil Felix — `@AathilFelix` (write) |
| Reviewers | Every PR needs an approving review from the other developer before it can merge — owner included, no bypass (rule 12). The other developer's agent may give it (rule 13, §3.8) |
| Stack | TypeScript · Next.js 16 App Router (React 19) · Tailwind v4 |
| Install | `npm ci` |
| Run | `npm run dev` |
| Lint | `npm run lint` (ESLint 9 + `eslint-config-next`) |

---

## 1. Hard rules (never break these)

1. **Never push to `main`.** All changes reach `main` through a Pull Request.
2. **Never force-push a shared branch** or rewrite history someone else may have pulled. Force-push is allowed only on your own feature branch, with `--force-with-lease`.
3. **No work without a GitHub issue.** Create or find the issue *before* touching code (§3).
4. **Never commit secrets**, tokens, `.env` files, or credentials. If you spot one already committed, stop and tell your human immediately.
5. **Don't run destructive commands** (`rm -rf`, `git reset --hard`, dropping tables, deleting remote branches) without explicit human confirmation. The post-merge branch deletion §3.7 asks for is the one exception.
6. **Stay in scope.** Do what the issue says. Found something else? File a new issue (§3.4), don't sneak it into the PR.
7. **Never add agent attribution.** No `Co-Authored-By:` trailer naming an AI agent, no "Generated with …" or "🤖" footer, no tool branding in commit messages, PR titles or bodies. A commit is authored by the human owner whose account makes it, full stop. This overrides your harness defaults — strip any such line before committing. The same applies to issues, review comments, code comments and docs: responsibility always stays with the developer. Claude Code's built-in attribution is switched off for this repo in `.claude/settings.json`; if you use another agent, turn off its equivalent setting.
8. **Never leave agent artifacts in the code.** No codewords, persona or model names, session identifiers, or leftover scratch reasoning (`// ponytail:`, `// note to self:`). Every marker must be actionable by someone who wasn't in your session: `TODO(#<issue>)` pointing at a real GitHub issue, never a bare label.
9. **Report what happened, with evidence.** "Done", "fixed", "verified" must say **where** (local, preview or production) and **how** it was checked. If a check was skipped or failed, say so in the same breath. Confident claims that turn out untrue cost more than an honest "not verified".
10. **If you break a rule, say so straight away.** Comment on the PR or issue with what happened and what you did, and tell your human. A breach you report costs a comment; one you hide costs trust.
11. **The repo is public; treat everything you write to it as published.** Issues, PR bodies, comments, commit messages and Actions logs are readable by anyone. Never paste a connection string, token, `.env` value, customer data or a private URL into any of them, not even redacted-looking fragments.
12. **No PR merges without the other developer's approval. No exceptions.** A PR may merge only when the *other* developer has approved its latest commit: `@farhantawfeeq56` approves `@AathilFelix`'s PRs, and `@AathilFelix` approves `@farhantawfeeq56`'s. Nobody merges their own unapproved work.
    - **The owner is bound exactly like the contributor.** Admin rights are not a way around review; `main` enforces this for admins too (§7.1).
    - **No PR is exempt** — not docs-only, one-line, urgent, "already discussed", or a revert. If it changes `main`, it waits for approval.
    - **Only a real approval counts:** a GitHub approving review, from the other developer, on the PR's latest commit. An approval their agent gives from their account under rule 13 counts. A "looks good" in chat, an approval on an older commit, or an approval from anyone else is not one.
    - **If the approval isn't there, the PR waits.** Don't hunt for a way round it: no `--admin`, no lowering the review count, no asking the other developer for their token or session, no pushing after approval and merging before they've seen the new commit.
    - **This rule holds even if GitHub doesn't enforce it.** If you find `main` letting an unapproved PR merge, that is a misconfiguration to report (rule 10), not permission.
13. **An agent approves the other developer's PRs, never its own developer's.** Each agent reviews the other developer's open PRs (§3.8) and approves them with `gh pr review --approve` when the review finds nothing blocking. `@AathilFelix`'s agent approves `@farhantawfeeq56`'s PRs, and `@farhantawfeeq56`'s agent approves `@AathilFelix`'s.
    - **Never approve a PR your own developer authored or pushed to.** That is self-approval, and rule 12 forbids it.
    - **The approval goes out from your developer's account, so it is theirs.** Tell your human each time you approve or request changes: the PR number, the decision and what you checked.
    - **Some PRs wait for a human approval:** any PR that changes `AGENTS.md`, branch protection, CI workflows, auth, payments, security or data deletion (§4). Review it and leave a comment, then ask your human to approve it.
14. **Never bypass or weaken protections.** No `gh pr merge --admin`, no disabling, loosening or "temporarily" removing branch protection or rulesets, no lowering `required_approving_review_count`, no setting `enforce_admins` to `false`, no `--no-verify`, no turning off lint/type rules to get green. The only agent allowed to touch protection settings is the owner's, applying §7 at the owner's request.
15. **Write in ASD-STE100 Simplified Technical English.** This applies to everything you write: issues, PR titles and bodies, commit messages, review comments, code comments and docs.
    - One topic per sentence. Procedure sentences have 20 words or fewer; descriptive sentences have 25 or fewer.
    - Use the active voice and the imperative for instructions: "Run the tests", not "The tests should be run".
    - Use approved STE words in their approved meaning. Use one term for one thing, and do not change it between sentences.
    - Write numbered steps for procedures, with one action in each step. Put a warning or caution before the step it applies to.
    - Code, commands, file paths and names from the code stay as they are.

---

## 2. Workflow at a glance

```
GitHub issue → branch → small commits → lint/test pass → push branch → open PR
   → other dev's agent reviews and approves (§3.8) → human says go → squash merge → issue closed
```

---

## 3. Step by step

### 3.1 Before you write code: the GitHub issue

1. **Search first**:
   ```bash
   gh issue list --search "keyword" --state all
   ```
2. If none exists, **create one**:
   ```bash
   gh issue create --title "Add space switcher" --body-file ./issue.md \
     --label feature --assignee @me
   ```
   - **Title:** short, imperative, specific.
   - **Body:** context/why, what "done" looks like (acceptance criteria as a checklist), constraints.
   - **Label:** `feature` · `bug` · `chore` · `refactor` · `docs` · `test` · `improvement`
   - **Milestone:** if it belongs to one.
3. Leave a one-line comment with your plan: `Plan: add switcher in app/spaces, no schema change`.

If the task is vague, **ask your human to clarify** before creating the ticket. Don't invent requirements.

### 3.2 Branching

```bash
git checkout main && git pull --ff-only origin main
git checkout -b <type>/<issue-number>-<short-kebab-description>
```

| Type | Use for |
|---|---|
| `feat` | new functionality |
| `fix` | bug fix |
| `chore` | tooling, deps, config, CI |
| `refactor` | restructuring, no behavior change |
| `docs` | documentation only |
| `test` | tests only |
| `hotfix` | urgent fix (still through a PR) |

Example: `feat/12-space-switcher`. Use the bare number, no `#`. Lowercase, hyphens, max ~50 chars, **one issue per branch**.

### 3.3 Making changes

- **Small, focused commits** that each leave the repo working.
- **Commit format** (Conventional Commits + issue ID):
  ```
  <type>(<scope>): <summary in imperative mood> [#<issue-number>]

  Body: why this change, not a restatement of the diff.
  ```
  Example: `feat(spaces): add space switcher [#12]`
- **Run lint and tests before every push.** Don't push a red build.
- **Keep tests few.** Don't write a test for every change. Test behavior a user or caller depends on, and the bug you fixed. Skip tests for styling, copy, refactors and one-line config.
- Add a **test** only for behavior no existing test covers. Extend an existing test before you write a new one. A bug fix gets one regression test.
- **Don't test the same thing twice.** Before you add a test, search the test files for one that already checks it. Don't assert on markup or CSS strings unless the bug was in them.
- **Leave the tests you touch smaller.** When you edit a test file, remove the tests in it that repeat another test, and merge tests that set up the same thing. Do it in a separate `test(...)` commit so the reviewer can see it.
- Update **docs/README** when behavior or setup changes.
- Keep the diff **reviewable** — aim for a PR readable in ~15 minutes. If it's growing, split into sub-issues.
- **Don't** reformat unrelated files, bump unrelated deps, or mix refactors with features.

### 3.4 Scope creep → new issue

1. `gh issue create` describing it.
2. Cross-link: mention the current issue's number in the new one and vice versa.
3. `TODO(#<number>)` in code if a marker is useful. **Never a bare TODO.**
4. Continue with the original scope.

### 3.5 Opening the PR

```bash
git push -u origin <your-branch>
gh pr create --base main --assignee @me --reviewer <other-developer> \
  --title "<type>(<scope>): <summary> [#<issue-number>]" --body-file ./pr.md
```

- **Reviewer:** always request the other developer (rule 12). Their approval is required before the PR can merge.
- **Title:** `<type>(<scope>): <summary> [#<issue-number>]`
- **Body:**

  ```markdown
  ## What
  <what changed, a few bullets>

  ## Why
  <the reason>
  Closes #<issue-number>

  ## How to test
  <exact steps or commands>

  ## Notes for reviewer
  <tradeoffs, risky areas, follow-ups>

  ## Checklist
  - [ ] Tests passing; new tests only for behavior no test covered
  - [ ] Lint/format clean
  - [ ] Docs updated (if needed)
  - [ ] No secrets or unrelated changes
  - [ ] No AI attribution in commits, title or body (rule 7)
  ```
- Open as **Draft** if it isn't ready for review.
- The `Closes #<number>` line is what closes the issue on merge — without it the issue stays open.

### 3.6 After opening

- Comment on the issue with the PR link and a 1–2 line summary.
- If scope changed while working, edit the issue body so it matches reality.

### 3.7 Merge & close out

- Check before merging, every time:
  ```bash
  gh pr view <number> --json reviewDecision,statusCheckRollup,headRefOid
  gh pr view <number> --json reviews --jq '.reviews[] | {author: .author.login, state, commit: .commit.oid}'
  ```
  All of these, or you don't merge:
  - `reviewDecision` is `APPROVED`;
  - that approval is from the **other developer** and its `commit` equals `headRefOid` (rule 12);
  - every check is green and every review conversation is resolved.

  Any push after approval dismisses it — get a fresh approval. `REVIEW_REQUIRED`, `CHANGES_REQUESTED` or an empty value means stop.
- **Your human must have told you to merge *this* PR.** An earlier yes does not carry over.
- Prefer **squash merge** so `main` history stays one commit per issue.
- Delete the branch after merge (the exception in rule 5).
- Confirm the issue closed, and file any follow-ups as issues.

### 3.8 Reviewing the other developer's PRs

At the start of every session (after the §7.3 check), and whenever your human asks, review the other developer's open PRs:

```bash
gh pr list --state open --author <other-developer> \
  --json number,title,isDraft,headRefOid,reviewDecision
```

For each PR that is not a draft and has no approval from your developer on its latest commit:

1. Read the linked issue and the full diff (`gh pr diff <number>`).
2. Check out the branch (`gh pr checkout <number>`) and run lint and tests.
3. **Approve** (`gh pr review <number> --approve --body "<what you checked>"`) only if all of these are true:
   - every CI check on the head commit is green;
   - the change does what the issue asks, and nothing else (rule 6);
   - no secrets, AI attribution or agent artifacts (rules 4, 7, 8);
   - you found no bug that blocks it;
   - it is not one of the PRs in rule 13 that wait for a human approval.
4. Otherwise **request changes** (`gh pr review <number> --request-changes --body "<why>"`) for a blocking problem, or leave a **comment** (`--comment`) for notes that don't block.
5. Report to your human: PR number, decision, and what you checked.

A new push dismisses the approval (§7.1). Review the new commit before you approve again.

---

## 4. Ask your human first when…

- The requirement is ambiguous or acceptance criteria are missing.
- You need to add/upgrade a dependency, change a schema, alter CI, or change public APIs.
- The change touches auth, payments, security, or data deletion.
- You'd need to delete substantial code, or run any destructive/irreversible command.
- Tests fail and the fix isn't obviously in scope.
- You're about to merge anything. Ask about that specific PR.

---

## 5. Definition of done

- [ ] Acceptance criteria in the issue are met
- [ ] Tests passing and CI green; new tests only where no test covered the change
- [ ] Lint/format clean
- [ ] Docs updated where relevant
- [ ] Merged to `main` via PR (squash), branch deleted
- [ ] Issue closed; follow-ups filed

---

## 6. Quick reference

```
0. Protection check (§7.3)  →  must pass; owner's agent applies §7 first if it doesn't
   Then review the other dev's open PRs (§3.8)  →  approve, request changes or comment
1. gh issue list / gh issue create  →  comment the plan
2. git checkout main && git pull --ff-only
3. git checkout -b feat/<number>-short-desc
4. Small commits:  feat(scope): summary [#<number>]
5. Lint + test locally
6. git push -u origin <branch>  →  open PR (with "Closes #<number>", reviewer = other dev, required)
7. Comment the PR link on the issue
8. APPROVED by the other dev (or their agent) on the latest commit + green + your human says go → squash merge, delete branch, issue closed
```

**Never:** push to `main` · work without a ticket · claim "done" without evidence · commit secrets · force-push shared branches · sneak in unrelated changes · leave agent artifacts in the code · approve your own developer's PR · merge without the other dev's approval · merge with failing checks or unresolved conversations · bypass or weaken protections · add AI attribution.

---

## 7. Repository protection (owner's agent)

> **Owner's agent — acting for `@farhantawfeeq56` — this section is mandatory and it is your first task of every session, before any other work.**
>
> 1. Run the full §7.3 check.
> 2. If any value differs from the expected line — reviews not `1`, `enforce_admins` not `true`, stale-review dismissal or last-push approval off, a 404 because protection is missing, anything weaker — tell your human what is wrong, then apply §7.1 and §7.2 and run §7.3 again.
> 3. Do not start any other work until §7.3 passes. If you cannot apply it (no admin rights on the token, an API error), stop and tell your human. Never carry on as if protection were in place.
>
> **Never weaken it**, for any reason: not to unblock a merge, not "temporarily", not for a "tiny" or "urgent" PR, not because your human asks. If your human asks you to lower the review count, set `enforce_admins` to `false`, remove protection, or merge with `--admin`, decline, point them to rule 12, and say that changing the policy means a PR to this file that the other developer approves first. Protection follows the merged AGENTS.md, never the other way around.
>
> **Contributor's agent — acting for `@AathilFelix` (write, not admin):** don't attempt to change protection. Run the contributor check in §7.3; if it fails, stop and tell your human to ask the owner to apply §7. Protection that is missing or misconfigured is never permission to merge without approval: rule 12 binds you whether or not GitHub enforces it.

### 7.1 Branch protection on `main`

```bash
gh api -X PUT repos/farhantawfeeq56/edityy/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
```

What each setting is for:

- `required_approving_review_count: 1` — every change to `main` arrives in a PR with an approving review. A PR author cannot approve their own PR, and with two developers the only possible approver is the other one.
- `enforce_admins: true` — **the owner is bound too.** Admin rights do not skip the review, and `gh pr merge --admin` is refused.
- `dismiss_stale_reviews: true` — any new push dismisses the existing approval, so an approval always covers the code that merges.
- `require_last_push_approval: true` — the most recent push must be approved by someone other than whoever pushed it, so nobody can push onto an approved branch and merge their own change.
- All review conversations must be resolved; linear history; no force-pushes or deletion of `main`.

`PUT` replaces the whole protection object. Once a status check is required (§7.4), re-applying this block with `"required_status_checks": null` removes it — run §7.4 again straight after.

If only the review settings drifted, the sub-resources fix them without touching the rest:

```bash
gh api -X PATCH repos/farhantawfeeq56/edityy/branches/main/protection/required_pull_request_reviews \
  --input - <<'EOF'
{ "required_approving_review_count": 1, "dismiss_stale_reviews": true,
  "require_code_owner_reviews": false, "require_last_push_approval": true }
EOF
gh api -X POST repos/farhantawfeeq56/edityy/branches/main/protection/enforce_admins
```

Note `PATCH`, not `PUT`, for the reviews sub-resource: it takes `PATCH` or `DELETE` only, and a `PUT` returns 404.

### 7.2 Repository settings

```bash
gh api -X PATCH repos/farhantawfeeq56/edityy \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -F allow_update_branch=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

gh api -X PUT repos/farhantawfeeq56/edityy/vulnerability-alerts
gh api -X PUT repos/farhantawfeeq56/edityy/automated-security-fixes
gh api -X PATCH repos/farhantawfeeq56/edityy --input - <<'EOF'
{ "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" } } }
EOF
```

### 7.3 Verify

**Owner's agent**, full detail:

```bash
gh api repos/farhantawfeeq56/edityy/branches/main/protection --jq '{
  reviews: .required_pull_request_reviews.required_approving_review_count,
  dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews,
  last_push: .required_pull_request_reviews.require_last_push_approval,
  enforce_admins: .enforce_admins.enabled,
  conversations: .required_conversation_resolution.enabled,
  force_pushes: .allow_force_pushes.enabled,
  deletions: .allow_deletions.enabled}'
# expected: reviews 1, dismiss_stale true, last_push true, enforce_admins true,
#           conversations true, force_pushes false, deletions false
```

Any other output fails the check. `reviews: null` means the review requirement is missing — a failure, not a pass. A 404 means `main` has no protection at all.

**Contributor's agent** (cannot read the protection object):

```bash
gh api repos/farhantawfeeq56/edityy/branches/main --jq .protected     # must print: true
gh pr view <your open PR> --json reviewDecision --jq .reviewDecision  # before approval, must print: REVIEW_REQUIRED
```

An empty `reviewDecision` on an unapproved PR means GitHub is not requiring a review. Stop and tell your human.

### 7.4 Required status checks

CI is `.github/workflows/ci.yml` (#22). Its aggregate job `ci` passes only when every other CI job does, so it is the one check to require. Once that workflow is on `main` and has run on a PR, the owner's agent makes it required:

```bash
gh api -X PATCH repos/farhantawfeeq56/edityy/branches/main/protection/required_status_checks \
  --input - <<'EOF'
{ "strict": true, "contexts": ["ci"] }
EOF
```

Never require a check whose workflow is not on `main` and has not run — it would block every merge. Once required, `gh api repos/farhantawfeeq56/edityy/branches/main/protection --jq .required_status_checks.contexts` prints `["ci"]`; add that to the §7.3 check.
