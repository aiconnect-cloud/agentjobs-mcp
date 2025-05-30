# Agent Jobs MCP Server

An MCP (Model Context Protocol) server that allows AI agents to query and manage jobs in the Agent Jobs system of the AI Connect platform.

## About Agent Jobs

Agent Jobs is a robust asynchronous task management system on the AI Connect platform, enabling the creation, monitoring, and execution of jobs across different platforms like Slack and WhatsApp, with support for scheduled execution, automatic retries, and timeout handling. The Agent Jobs manipulation API provides endpoints to create, list, query, and cancel jobs, allowing developers and external systems to easily integrate asynchronous processing functionalities into their applications, automating complex workflows without the need to implement the entire task management infrastructure.

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

The MCP server comes with default values from `.env-example`, so you can run it without setting any environment variables. However, you **must** provide an API key for authentication.

```bash
cp .env-example .env
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

### Configuration Options

This MCP server is designed to work out-of-the-box with minimal configuration. It uses a smart fallback system:

1. **With environment variables**: Full control over all settings
2. **Without environment variables**: Uses defaults from `.env-example`
3. **Partial configuration**: Mix of environment variables and defaults

**Default Values (when no env vars are set):**
- `DEFAULT_ORG_ID`: `"aiconnect"`
- `AICONNECT_API_URL`: `"https://api.aiconnect.cloud/api/v0"`
- `AICONNECT_API_KEY`: `""` (empty - you must provide this)

**Error Handling:**
- If `AICONNECT_API_KEY` is not provided, tools will return helpful error messages
- If `AICONNECT_API_URL` is not set, it defaults to the production API
- If `DEFAULT_ORG_ID` is not set, it defaults to "aiconnect"

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

## Available Tools

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
│   ├── index.ts           # Main MCP server
│   ├── cancel_job.ts      # Tool for canceling jobs
│   ├── create_job.ts      # Tool for creating jobs
│   ├── get_job.ts         # Tool for querying job
│   └── list_jobs.ts       # Tool for listing jobs
├── build/                 # Compiled JavaScript code
├── docs/                  # Documentation
│   └── agent-jobs-api.md  # API documentation
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env-example           # Environment variables example
└── README.md              # This file
```

## Development

### Available scripts

- `npm run build`: Compiles TypeScript
- `npm start`: Runs the compiled server

### Adding new tools

1. Create a new file in the `src/` folder (e.g., `new_tool.ts`)
2. Implement the tool following the pattern of existing files
3. Register the tool in `src/index.ts`
4. Recompile with `npm run build`

## Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For technical support or questions about Agent Jobs:
- Check the [API documentation](docs/agent-jobs-api.md)
- Contact the AI Connect development team

---

**Note**: This project was developed using the Anthropic mcp-tools scaffold for integration with the Agent Jobs system of the AI Connect platform.
