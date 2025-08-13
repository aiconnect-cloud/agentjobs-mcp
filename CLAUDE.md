# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that enables AI agents to interact with the AI Connect Jobs platform. It provides tools for creating, managing, and monitoring asynchronous jobs across platforms like Slack and WhatsApp.

## Essential Commands

### Development
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run development (build + start)
npm run dev

# Start the server (requires build)
npm start
```

### Testing & Quality
```bash
# Type checking - ALWAYS run before committing
npm run typecheck

# Linting - ALWAYS run before committing
npm run lint
npm run lint:fix  # Auto-fix issues

# Run tests
npm test

# Test tool loading without starting server
npm run test:tools
```

### Debugging
```bash
# Run in debug mode with detailed logging
npm run debug

# Show current configuration
npm run cli:config

# Interactive debugging (Fish shell)
./debug.fish help
./debug.fish quick
```

### NPM Publishing
```bash
# Clean build and publish
npm run release

# Version bumps
npm run version:patch
npm run version:minor
npm run version:major
```

## Architecture

### Core Structure
- **Entry Point**: `src/index.ts` - Uses standard McpServer with proper capabilities declaration, dynamically loads tools from `src/tools/` directory, handles CLI arguments
- **MCP Server**: Uses official McpServer from SDK with tools, logging, resources, and prompts capabilities declared
- **Tool Registration**: Tools are auto-discovered and registered from `src/tools/*.js` files at runtime using modern `registerTool()` API

### Tool Pattern
Each tool in `src/tools/` follows this structure:
1. Default export function that receives McpServer instance
2. Uses `server.registerTool()` (modern API) with name, configuration object including `description`, `annotations.title`, and `inputSchema`, and handler
3. Returns MCP-compliant response format: `{ content: [{ type: "text", text: "..." }] }`
4. Error responses include proper error handling and debugging

### API Client
- `src/lib/agentJobsClient.ts` - Centralized HTTP client for AI Connect API
- Handles authentication, error responses, and request/response formatting
- Uses axios for HTTP requests with proper headers and error handling

### Configuration
- Environment variables loaded via dotenv from `.env` file
- `src/config.ts` exports configuration with defaults:
  - `AICONNECT_API_URL`: Default `https://api.aiconnect.cloud/api/v0`
  - `AICONNECT_API_KEY`: Required, no default
  - `DEFAULT_ORG_ID`: Default `aiconnect`

### Utilities
- `src/utils/formatters.ts` - Formats job data for human-readable output
- `src/utils/schemas.ts` - Shared Zod schemas (e.g., flexible datetime parsing)
- `src/utils/debugger.ts` - Debug logging utilities with timing measurements

## Available Tools

1. **list_jobs** - Query jobs with filtering, pagination, sorting
2. **get_job** - Retrieve specific job details by ID
3. **create_job** - Create new immediate or scheduled jobs
4. **cancel_job** - Cancel running or scheduled jobs
5. **get_jobs_stats** - Get aggregated statistics without individual job data
6. **get_job_type** - Get job type configuration details

## Adding New Tools

1. Create `src/tools/your_tool_name.ts`
2. Follow existing tool pattern with Zod validation
3. Run `npm run build` to compile
4. Test with `npm run test:tools`
5. Tool auto-registers on server start

## Environment Setup

Required environment variables:
```env
AICONNECT_API_URL=https://api.aiconnect.cloud/api/v0
AICONNECT_API_KEY=your-api-key-here
DEFAULT_ORG_ID=your-organization  # Optional, defaults to 'aiconnect'
```

## Testing Considerations

- Test files use `.test.ts` suffix in `src/` directory
- Vitest configured for Node environment with globals
- Mock API responses when testing tools
- Use `npm run test:tools` to verify tool loading without full server start

## Git Workflow

- Main branch: `main` (for PRs)
- Development branch: `develop`
- Current branch tracked in git status
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Follow conventional commits: `type(scope): description`
- **Important**: Do NOT include Claude Code signature in commits (`🤖 Generated with [Claude Code]`)

## Common Development Tasks

When modifying tools:
1. Edit tool file in `src/tools/`
2. Run `npm run build` to compile
3. Run `npm run typecheck` to verify types
4. Run `npm run lint` to check code style
5. Test with `npm run test:tools` or full server start

When debugging API issues:
1. Set `DEBUG=true` environment variable
2. Use `npm run debug` for detailed logging
3. Check `npm run cli:config` for current configuration
4. Review API responses in debug output

## Important Notes

- Tools are automatically discovered from `src/tools/` directory
- Server follows official MCP specification with proper capabilities declaration
- Tools use modern `registerTool()` API with titles and structured configuration
- All datetime inputs support flexible formats via `flexibleDateTimeSchema`
- API errors are caught and returned in standard MCP format
- Configuration falls back to defaults when environment variables are missing
- Comprehensive logging capability enables better debugging and observability