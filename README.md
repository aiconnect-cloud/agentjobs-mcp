# AI Connect MCP Server

An MCP (Model Context Protocol) server that allows AI agents to query and manage jobs in the AI Connect platform.

## About AI Connect Jobs

AI Connect Jobs is a robust asynchronous task management system on the AI Connect platform, enabling the creation, monitoring, and execution of jobs across different platforms like Slack and WhatsApp, with support for scheduled execution, automatic retries, and timeout handling. The API provides endpoints to create, list, query, and cancel jobs, allowing developers and external systems to easily integrate asynchronous processing functionalities into their applications, automating complex workflows without the need to implement the entire task management infrastructure.

## Features

This MCP Server provides tools for AI agents to:

- 📋 **List Jobs**: Query all jobs with advanced filtering
- 🔍 **Get Specific Job**: Retrieve details of a specific job by ID
- ✅ **Create Jobs**: Create new jobs for immediate or scheduled execution
- ❌ **Cancel Jobs**: Cancel running or scheduled jobs
- 📊 **Monitor Status**: Track job status (WAITING, RUNNING, COMPLETED, FAILED, CANCELED)

## Technologies

- **Node.js** with **TypeScript**
- **Model Context Protocol (MCP)** by Anthropic
- **Zod** for schema validation
- **AI Connect API** for integration with the Agent Jobs system

## Installation

### NPX (Recommended)

You can run the MCP server directly using npx without installation:

```bash
npx @aiconnect/agentjobs-mcp --help
```

### Local Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd agentjobs-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables (Optional):**

The MCP server comes with default values from `.env.example`, so you can run it without setting any environment variables. However, you **must** provide an API key for authentication.

```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:
```env
DEFAULT_ORG_ID=your-organization     # Default: aiconnect
AICONNECT_API_KEY=your-api-key       # Required: Must be provided
AICONNECT_API_URL=https://api.aiconnect.cloud/api/v0  # Default
```

**Important**: If no environment variables are provided, the server will use these defaults:
- `DEFAULT_ORG_ID`: `aiconnect`
- `AICONNECT_API_URL`: `https://api.aiconnect.cloud/api/v0`
- `AICONNECT_API_KEY`: empty (must be provided for API calls to work)

4. **Build the project:**
```bash
npm run build
```

## Usage

### CLI Usage

The MCP server now supports CLI commands for easy management:

```bash
# Show help and usage information
npx @aiconnect/agentjobs-mcp --help

# Show version information
npx @aiconnect/agentjobs-mcp --version

# Show current configuration status
npx @aiconnect/agentjobs-mcp --config

# Start MCP server (default behavior)
npx @aiconnect/agentjobs-mcp
```

**Setting Environment Variables:**
```bash
# Using environment variables with npx
AICONNECT_API_URL=https://api.aiconnect.cloud/api/v0 \
AICONNECT_API_KEY=your-api-key-here \
npx @aiconnect/agentjobs-mcp

# Or create a .env file (recommended for development)
cp .env.example .env
# Edit .env with your credentials
npx @aiconnect/agentjobs-mcp
```

**Required Environment Variables:**
- `AICONNECT_API_URL`: API endpoint URL (e.g., https://api.aiconnect.cloud/api/v0)
- `AICONNECT_API_KEY`: Your API authentication key

**CLI Command Examples:**
```bash
# Quick help
npx @aiconnect/agentjobs-mcp -h

# Check version
npx @aiconnect/agentjobs-mcp -v

# Verify configuration before starting
npx @aiconnect/agentjobs-mcp -c

# Test with environment variables
env AICONNECT_API_URL=https://api.aiconnect.cloud/api/v0 \
    AICONNECT_API_KEY=test-key \
    npx @aiconnect/agentjobs-mcp --config
```

### Local Development

For local development, you can use npm scripts:

```bash
# Build and test CLI commands
npm run cli:help
npm run cli:version  
npm run cli:config

# Run test suite (if available)
npm run test:cli
```

### Configuration Options

This MCP server is designed to work out-of-the-box with minimal configuration. It uses a smart fallback system:

1. **With environment variables**: Full control over all settings
2. **Without environment variables**: Uses defaults from `.env.example`
3. **Partial configuration**: Mix of environment variables and defaults

**Default Values (when no env vars are set):**
- `DEFAULT_ORG_ID`: `"aiconnect"`
- `AICONNECT_API_URL`: `"https://api.aiconnect.cloud/api/v0"`
- `AICONNECT_API_KEY`: `""` (empty - you must provide this)

**Error Handling:**
- The server will always start, even if environment variables are missing.
- If `AICONNECT_API_KEY` or `AICONNECT_API_URL` are not provided, each tool will return a clear error message upon execution, guiding the user to configure the environment correctly.
- If `DEFAULT_ORG_ID` is not set, it defaults to "aiconnect".

### Running the MCP server

```bash
npm start
```

The server will start and wait for connections via stdio transport.

### Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following configuration to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "agentjobs": {
      "command": "node",
      "args": ["/path/to/agentjobs-mcp/build/index.js"],
      "env": {
        "DEFAULT_ORG_ID": "your-organization",
        "AICONNECT_API_KEY": "your-api-key",
        "AICONNECT_API_URL": "https://api.aiconnect.cloud/api/v0"
      }
    }
  }
}
```

### Local Development with Claude Code

For development and testing, you can add this MCP server directly to your Claude Code project:

```bash
# Prerequisites: build the project first
npm install
npm run build

# Configure your .env file
cp .env.example .env
# Edit .env with your API credentials

# Add MCP server to Claude Code (project scope)
claude mcp add --scope project agentjobs -- ./mcp-agentjobs.sh
```

This allows you to test and use the AgentJobs tools directly within Claude Code during development, providing immediate feedback and easier debugging.

## Available Tools

### 📊 `get_jobs_stats`
Get aggregated statistics for agent jobs without retrieving individual job data. Optimized for dashboards and monitoring with minimal network overhead.

**Parameters:**
- `scheduled_at_gte`: Start of period (ISO 8601)
- `scheduled_at_lte`: End of period (ISO 8601)
- `org_id`: Organization filter
- `job_type_id`: Job type filter
- `tags`: Tags filter (comma-separated)
- `status`: Status filter
- `channel_code`: Channel filter

### 🔧 `list_jobs`
Lists all jobs with filtering and pagination options.

**Parameters:**
- `status` (optional): Filter by status (WAITING, RUNNING, COMPLETED, FAILED, CANCELED)
- `job_type_id` (optional): Filter by job type
- `channel_code` (optional): Filter by channel code
- `limit` (optional): Result limit (default: 50)
- `offset` (optional): Pagination offset
- `sort` (optional): Field and direction for sorting

### 🔍 `get_job`
Gets details of a specific job.

**Parameters:**
- `job_id` (required): ID of the job to query

### ✅ `create_job`
Creates a new job for execution.

**Parameters:**
- `target_channel`: Target channel configuration
- `job_type_id`: Job type ID
- `config`: Job configuration (timeouts, retries, etc.)
- `params`: Job-specific parameters
- `scheduled_at` (optional): Date/time for scheduled execution
- `delay` (optional): Random delay in minutes

### ❌ `cancel_job`
Cancels a running or scheduled job.

**Parameters:**
- `job_id` (required): ID of the job to cancel
- `reason` (optional): Cancellation reason

## Job Status

Jobs can have the following status values:

- `WAITING`: Job waiting for execution
- `SCHEDULED`: Job scheduled for future execution
- `RUNNING`: Job currently running
- `COMPLETED`: Job completed successfully
- `FAILED`: Job failed
- `CANCELED`: Job was canceled

## Usage Examples

### List running jobs
```
Agent: "Show me all jobs that are currently running"
```

### Query specific job
```
Agent: "What's the status of job job-123?"
```

### Create scheduled job
```
Agent: "Create a daily report job for Slack channel C123456 to run tomorrow at 9 AM"
```

### Cancel job
```
Agent: "Cancel job job-456 because it's no longer needed"
```

## Project Structure

```
agentjobs-mcp/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main MCP server entry point
│   ├── config.ts          # Configuration loader
│   └── tools/             # Directory for all MCP tools
│       ├── get_jobs_stats.ts # Tool for getting job statistics
│       ├── list_jobs.ts   # Tool for listing jobs
│       ├── get_job.ts     # Tool for getting a job
│       ├── create_job.ts  # Tool for creating a job
│       └── cancel_job.ts  # Tool for canceling a job
├── build/                 # Compiled JavaScript code
├── docs/                  # Documentation
│   └── agent-jobs-api.md  # API documentation
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Environment variables example
└── README.md              # This file
```

## Development

### Available scripts

- `npm run build`: Compiles TypeScript
- `npm start`: Runs the compiled server
- `npm run debug`: Runs server in debug mode with detailed logging
- `npm run test:tools`: Tests tool loading without starting server
- `npm run cli:config`: Shows current configuration
- `npm run cli:version`: Shows version information
- `npm run cli:help`: Shows help information

### Debugging

For detailed debugging information, see [Debug Guide](docs/debug-guide.md).

**Quick Debug Commands:**
```bash
# Test configuration
npm run cli:config

# Test tool loading
npm run test:tools

# Run in debug mode
MCP_DEBUG=true npm run debug

# Use debug helper script (Fish shell)
./debug.fish help
./debug.fish quick
```

**Debug Environment:**
```bash
# Copy debug environment template
cp .env.debug .env
# Edit .env with your API credentials
# Run with debug environment
./debug.fish debug-with-env
```

### Adding new tools

Adding a new tool is simple:

1. Create a new TypeScript file inside the `src/tools/` directory (e.g., `my_new_tool.ts`).
2. Implement your tool logic following the existing pattern. The server will automatically detect and register it on startup.
3. Recompile the project with `npm run build`.
4. Test with `npm run test:tools` to verify loading.

## Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For technical support or questions about AI Connect Jobs:
- Check the [API documentation](docs/agent-jobs-api.md)
- Contact the AI Connect development team

---

**Note**: This project was developed using the Anthropic mcp-tools scaffold for integration with the AI Connect platform.
