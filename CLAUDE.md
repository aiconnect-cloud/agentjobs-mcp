# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@aiconnect/agentjobs-mcp` is an MCP (Model Context Protocol) server that exposes AI Connect's Agent Jobs API as a set of tools an LLM client (e.g. Claude Desktop, Claude Code) can call. It is published to npm and distributed both as an `npx`-runnable binary (`agentjobs-mcp`) and as a local build. Transport is stdio only.

## Common Commands

```bash
npm run build          # tsc → build/, marks build/index.js executable
npm start              # runs compiled server (build/index.js) over stdio
npm run dev            # build + start in one step
npm run typecheck      # tsc --noEmit (no output, types only)
npm run lint           # eslint . --ext .ts,.js
npm run lint:fix       # eslint --fix
npm test               # vitest (watches by default; tests live next to source as *.test.ts)
npm test -- src/utils/formatters.test.ts   # run a single test file
npm test -- -t "name"  # filter by test name
npm run test:tools     # build + dynamically import each tool to verify it registers (no server start)
npm run debug          # build + run src/debug.ts (interactive debug harness)
npm run cli:config     # show resolved config (uses .env)
npm run clean          # rm -rf build
```

CLI flags handled by `src/index.ts` itself (before server start): `--help|-h`, `--version|-v`, `--config|-c`, `--stdio`.

## Environment

Loaded via `dotenv` at startup from `.env`. Defaults live in `src/config.ts` — the server *always* starts even if vars are missing; the failure surfaces at first tool invocation through `AgentJobsClient`.

- `AICONNECT_API_URL` — required for real calls. Default: `https://api.aiconnect.cloud/api/v0`.
- `AICONNECT_API_KEY` — required. No default.
- `DEFAULT_ORG_ID` — default: `aiconnect`. Used as fallback when a tool's `org_id` param is omitted.
- `DEFAULT_TIMEZONE` — default: `UTC`. Informational only — surfaced via the `get_context` tool so LLM clients can format timestamps in the operation's preferred timezone. Does NOT alter behavior of other tools (timestamps are still emitted in UTC).
- `DEBUG=true` — enables debug logging via `src/utils/debugger.ts`.
- `.env.debug` — separate env file consumed by `src/test-tools.ts` and the debug harness.

## Architecture

The server is intentionally small. Three layers:

1. **Entry point — `src/index.ts`**
   - Loads `.env`, parses CLI flags, then boots an `McpServer` from `@modelcontextprotocol/sdk`.
   - **Dynamic tool loader**: at startup, reads every `.js` file in `build/tools/`, imports it, and calls its `default(server)` export. There is no central registry — adding a file to `src/tools/` is sufficient. Tools that fail to load are logged but do not crash the server.
   - All informational output goes to `stderr` (stdout is reserved for the MCP stdio transport).

2. **HTTP client — `src/lib/agentJobsClient.ts`**
   - Singleton axios instance, lazily constructed on first use so missing env vars only error at call time.
   - Sends `Authorization: Bearer <key>` and `X-Client-Type: mcp` on every request.
   - Two response shapes are unwrapped here: standard list/detail responses return `data.data ?? data`; calls passing `include=stats` return the raw payload via `getStats()` / `getWithMeta()`. When adding a new tool, pick the matching helper rather than re-implementing unwrap logic.
   - `handleError()` normalizes axios errors into a single `Error` with `API Error (<status>): <message>`.

3. **Tools — `src/tools/*.ts`**
   - Each file `export default (server: McpServer) => { server.registerTool(...) }`. One tool per file.
   - Input schemas use Zod; common reusable schemas (e.g. `flexibleDateTimeSchema`) live in `src/utils/schemas.ts`.
   - Output is formatted into human-readable text via `src/utils/formatters.ts` before returning `{ content: [{ type: "text", text }] }`. Prefer extending an existing formatter to inventing a new response shape.
   - Debug tracing uses `mcpDebugger.toolCall()` and `withTiming()` from `src/utils/debugger.ts`.

**Canonical API reference: `docs/agent-jobs-api.md`** — when adding/modifying tools, this file (not the live API) is the source of truth for endpoint paths, request bodies, status enums, and the JobType schema. Keep tool descriptions and Zod enums in sync with it.

### Adding a tool

1. Create `src/tools/<snake_case_name>.ts` with `export default (server) => server.registerTool(...)`.
2. Reuse `agentJobsClient` (don't create a second axios instance) and a formatter from `utils/formatters.ts`.
3. Run `npm run test:tools` — it will fail loudly if the file doesn't expose a callable default export.
4. No registration step is needed: the dynamic loader picks it up on next build.

## Conventions

- File naming: `snake_case.ts` for tools, `camelCase.ts` for utilities and lib.
- ES modules (`"type": "module"`) with `Node16` resolution — **import paths must include the `.js` extension** even when importing from `.ts` source (e.g. `import x from "../config.js"`).
- TypeScript `strict: true`, but `eslint.config.js` deliberately relaxes the `no-unsafe-*` family and `no-explicit-any` to keep axios/MCP-SDK ergonomics tolerable. Don't add type assertions just to satisfy stricter rules that aren't enforced.
- Tests are colocated with source as `*.test.ts` and run by Vitest with `globals: true` (no need to import `describe`/`it`/`expect`).

## Security gate

Before pushing, run the `/security-scan` slash command (`.claude/commands/security-scan.md`). It runs three checks, in order:

- **Secrets** — `gitleaks detect` over the working tree and git history. The repo handles `AICONNECT_API_KEY` via `.env` / `.env.debug` (both gitignored); the scan catches accidental untracking, hard-coded keys, and stray fixtures.
- **Dependencies** — `npm audit --audit-level=high`. High/critical findings block the push; lower severities can be deferred but should be tracked.
- **Project checks** — `npm run typecheck`, `npm run lint`, `npm test -- --run`. These mirror the gates listed in `## Common Commands`.

Resolve findings — do not bypass with `--no-verify` or by silencing rules. Add real false positives to `.gitleaksignore` rather than weakening the scan.

## Behavioral Guidelines

These reduce common LLM coding mistakes. They bias toward caution over speed; for trivial tasks, use judgment.

### 1. Think before coding
- State assumptions explicitly. If multiple interpretations exist, surface them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.

### 2. Simplicity first
- Minimum code that solves the problem. No speculative features, single-use abstractions, or "configurability" that wasn't asked for.
- No error handling for impossible scenarios.

### 3. Surgical changes
- Don't "improve" adjacent code, comments, or formatting in passing. Match existing style even if you'd write it differently.
- Remove imports/variables that *your* changes orphaned. Don't delete pre-existing dead code unless asked.
- Every changed line should trace directly to the user's request.

### 4. Goal-driven execution
- Convert tasks into verifiable goals: "fix the bug" → "write a failing test, then make it pass"; "refactor X" → "tests pass before and after."
- For multi-step work, state a brief plan with a verify step per item before implementing.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
