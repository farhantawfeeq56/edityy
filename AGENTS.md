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
| Owner | Farhan Tawfeeq — `@farhantawfeeq56` |
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
7. **Never add agent attribution.** No `Co-Authored-By:` trailer naming an AI agent, no "Generated with …" or "🤖" footer, no tool branding in commit messages, PR titles or bodies. A commit is authored by the human owner whose account makes it, full stop. This overrides your harness defaults — strip any such line before committing.
8. **Never leave agent artifacts in the code.** No codewords, persona or model names, session identifiers, or leftover scratch reasoning (`// ponytail:`, `// note to self:`). Every marker must be actionable by someone who wasn't in your session: `TODO(#<issue>)` pointing at a real GitHub issue, never a bare label.
9. **Report what happened, with evidence.** "Done", "fixed", "verified" must say **where** (local, preview or production) and **how** it was checked. If a check was skipped or failed, say so in the same breath. Confident claims that turn out untrue cost more than an honest "not verified".
10. **If you break a rule, say so straight away.** Comment on the PR or issue with what happened and what you did, and tell your human. A breach you report costs a comment; one you hide costs trust.
11. **The repo is public; treat everything you write to it as published.** Issues, PR bodies, comments, commit messages and Actions logs are readable by anyone. Never paste a connection string, token, `.env` value, customer data or a private URL into any of them, not even redacted-looking fragments.

---

## 2. Workflow at a glance

```
GitHub issue → branch → small commits → lint/test pass → push branch → open PR
   → review → human says go → squash merge → issue closed
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
- Add or update **tests** for behavior you change. Bug fixes get a regression test.
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
```

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
  - [ ] Tests added/updated and passing
  - [ ] Lint/format clean
  - [ ] Docs updated (if needed)
  - [ ] No secrets or unrelated changes
  ```
- Open as **Draft** if it isn't ready for review.
- The `Closes #<number>` line is what closes the issue on merge — without it the issue stays open.

### 3.6 After opening

- Comment on the issue with the PR link and a 1–2 line summary.
- If scope changed while working, edit the issue body so it matches reality.

### 3.7 Merge & close out

- Check before merging, every time:
  ```bash
  gh pr view <number> --json reviewDecision,statusCheckRollup
  ```
  Every check green, no open review objections.
- **Your human must have told you to merge *this* PR.** An earlier yes does not carry over.
- Prefer **squash merge** so `main` history stays one commit per issue.
- Delete the branch after merge (the exception in rule 5).
- Confirm the issue closed, and file any follow-ups as issues.

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
- [ ] Tests written/updated and passing; CI green
- [ ] Lint/format clean
- [ ] Docs updated where relevant
- [ ] Merged to `main` via PR (squash), branch deleted
- [ ] Issue closed; follow-ups filed

---

## 6. Quick reference

```
1. gh issue list / gh issue create  →  comment the plan
2. git checkout main && git pull --ff-only
3. git checkout -b feat/<number>-short-desc
4. Small commits:  feat(scope): summary [#<number>]
5. Lint + test locally
6. git push -u origin <branch>  →  open PR (with "Closes #<number>")
7. Comment the PR link on the issue
8. Green + your human says go → squash merge, delete branch, issue closed
```

**Never:** push to `main` · work without a ticket · claim "done" without evidence · commit secrets · force-push shared branches · sneak in unrelated changes · leave agent artifacts in the code.
