# AI Connect MCP Server - Development Guidelines

This document outlines the development guidelines, standards, and best practices for the AI Connect MCP Server project.

This project is an MCP (Model Context Protocol) server that provides AI agents with the ability to interact with the AI Connect Jobs system from the AI Connect platform. It's built using Node.js, TypeScript, and follows the MCP specification from Anthropic.

## Environment Variables

Use the following environment variables for configuration:

- `AICONNECT_API_URL`: API endpoint URL (e.g., https://api.aiconnect.cloud/api/v0)
- `AICONNECT_API_KEY`: Your API authentication key

## Development Standards

### Code Style

- **Language**: TypeScript with strict mode enabled
- **Module System**: ES modules (ESM)
- **Code Formatting**: Use consistent indentation (2 spaces)
- **Naming Conventions**:
  - Files: `snake_case.ts` for tools, `camelCase.ts` for utilities
  - Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Types/Interfaces: `PascalCase`

### File Organization

```
src/
├── index.ts              # Main server entry point
├── tools/                # MCP tools directory
│   ├── list_jobs.ts     # Individual tool files
│   ├── get_job.ts
│   ├── create_job.ts
│   └── cancel_job.ts
├── types/               # Type definitions
├── utils/               # Utility functions
└── config/              # Configuration files
```

### Tool Development

#### Tool Structure

Each MCP tool should follow this pattern:

```typescript
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export default (server: McpServer) => {
  server.tool(
    "tool_name",
    "Clear description of what the tool does",
    {
      // Zod schema for parameters
      param1: z.string({
        description: "Description of parameter"
      }),
      param2: z.number().optional({
        description: "Optional parameter description"
      })
    },
    async (params) => {
      try {
        // Tool implementation
        
        return {
          content: [{
            type: "text",
            text: "Response content"
          }]
        };
      } catch (error) {
        // Error handling
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
};
```

#### Tool Guidelines

1. **Single Responsibility**: Each tool should have one clear purpose
2. **Error Handling**: Always wrap tool logic in try-catch blocks
3. **Validation**: Use Zod schemas for parameter validation
4. **Documentation**: Provide clear descriptions for tools and parameters
5. **Response Format**: Return consistent response structures

### API Integration

#### HTTP Client Standards

- Use native `fetch` for HTTP requests
- Implement proper error handling for API calls
- Include appropriate headers (Authorization, Content-Type)
- Handle rate limiting and timeouts

#### Environment Variables

Required environment variables:

```env
DEFAULT_ORG_ID=<organization-id>
AICONNECT_API_KEY=<api-key>
AICONNECT_API_URL=<api-base-url>
```

### Error Handling

#### Error Types

1. **Validation Errors**: Invalid parameters or missing required fields
2. **API Errors**: HTTP errors from AI Connect API
3. **Authentication Errors**: Invalid or expired API keys
4. **Network Errors**: Connection issues

#### Error Response Format

```typescript
{
  content: [{
    type: "text",
    text: "Error: [Category] - [Description]"
  }],
  isError: true
}
```

### Testing Guidelines

#### Test Structure

- Unit tests for individual tools
- Integration tests for API interactions
- Mock external dependencies

#### Test Files

- Place tests in `tests/` directory
- Name test files with `.test.ts` suffix
- Use descriptive test names

### Documentation

#### Code Documentation

- Use JSDoc comments for functions and classes
- Document complex logic with inline comments
- Keep documentation up to date with code changes

#### API Documentation

- Maintain API documentation in `docs/agent-jobs-api.md`
- Update tool documentation when adding new features
- Include usage examples

### Git Workflow

#### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

#### Commit Messages

Follow conventional commit format:

```
type(scope): description

feat(tools): add list_jobs filtering capability
fix(api): handle timeout errors properly
docs(readme): update installation instructions
```

#### Pull Request Process

1. Create feature branch from `main`
2. Make changes with appropriate tests
3. Update documentation if needed
4. Submit PR with clear description
5. Address review feedback
6. Merge after approval

### Security

#### API Key Management

- Never commit API keys to version control
- Use environment variables for sensitive data
- Rotate API keys regularly

#### Input Validation

- Validate all user inputs using Zod schemas
- Sanitize data before API calls
- Implement proper authorization checks

### Performance

#### Best Practices

- Implement request caching where appropriate
- Use connection pooling for API calls
- Handle large datasets with pagination
- Optimize for minimal memory usage

### Deployment

#### Build Process

```bash
npm run build  # Compile TypeScript
npm start      # Run compiled server
```

#### Environment Setup

- Development: Use `.env` file
- Production: Set environment variables in deployment system

### Troubleshooting

#### Common Issues

1. **Connection Errors**: Check API URL and network connectivity
2. **Authentication Failures**: Verify API key and organization ID
3. **Tool Not Found**: Ensure tool is registered in `index.ts`
4. **Parameter Validation**: Check Zod schema definitions

#### Debugging

- Use console logging for development
- Implement structured logging for production
- Monitor API response times and error rates

## Contributing

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Error handling is implemented
- [ ] Security considerations addressed
- [ ] Performance impact assessed

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. Deploy to production environment

---

For questions about these guidelines, please contact the development team or open an issue in the project repository.
