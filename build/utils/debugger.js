export class MCPDebugger {
    isDebugEnabled;
    constructor(enabled = process.env.MCP_DEBUG === 'true') {
        this.isDebugEnabled = enabled;
    }
    formatLog(level, message, data) {
        if (!this.isDebugEnabled)
            return;
        const timestamp = new Date().toISOString();
        const prefix = `[MCP-DEBUG ${timestamp}] [${level.toUpperCase()}]`;
        console.error(`${prefix} ${message}`);
        if (data !== undefined) {
            console.error(`${prefix} Data:`, JSON.stringify(data, null, 2));
        }
    }
    info(message, data) {
        this.formatLog('info', message, data);
    }
    warn(message, data) {
        this.formatLog('warn', message, data);
    }
    error(message, data) {
        this.formatLog('error', message, data);
    }
    debug(message, data) {
        this.formatLog('debug', message, data);
    }
    // Helper para debugar chamadas de tools
    toolCall(toolName, args) {
        this.info(`Tool called: ${toolName}`, { args });
    }
    toolResponse(toolName, response, duration) {
        this.info(`Tool response: ${toolName}`, {
            response: typeof response === 'object' ? response : { value: response },
            duration: duration ? `${duration}ms` : undefined
        });
    }
    toolError(toolName, error) {
        this.error(`Tool error: ${toolName}`, {
            error: error.message || error,
            stack: error.stack
        });
    }
    // Helper para debugar requisições HTTP
    httpRequest(method, url, data) {
        this.debug(`HTTP ${method.toUpperCase()} ${url}`, data);
    }
    httpResponse(method, url, status, data) {
        this.debug(`HTTP Response ${method.toUpperCase()} ${url} [${status}]`, data);
    }
    httpError(method, url, error) {
        this.error(`HTTP Error ${method.toUpperCase()} ${url}`, error);
    }
}
// Instância global do debugger
export const mcpDebugger = new MCPDebugger();
// Helper function para medir tempo de execução
export function withTiming(fn, name) {
    return new Promise(async (resolve, reject) => {
        const start = Date.now();
        mcpDebugger.debug(`Starting ${name}`);
        try {
            const result = await fn();
            const duration = Date.now() - start;
            mcpDebugger.debug(`Completed ${name} in ${duration}ms`);
            resolve(result);
        }
        catch (error) {
            const duration = Date.now() - start;
            mcpDebugger.error(`Failed ${name} after ${duration}ms`, error);
            reject(error);
        }
    });
}
