export interface DebugInfo {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export class MCPDebugger {
  private isDebugEnabled: boolean;

  constructor(enabled: boolean = process.env.MCP_DEBUG === 'true') {
    this.isDebugEnabled = enabled;
  }

  private formatLog(level: string, message: string, data?: any): void {
    if (!this.isDebugEnabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[MCP-DEBUG ${timestamp}] [${level.toUpperCase()}]`;

    console.error(`${prefix} ${message}`);

    if (data !== undefined) {
      console.error(`${prefix} Data:`, JSON.stringify(data, null, 2));
    }
  }

  info(message: string, data?: any): void {
    this.formatLog('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.formatLog('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.formatLog('error', message, data);
  }

  debug(message: string, data?: any): void {
    this.formatLog('debug', message, data);
  }

  // Helper para debugar chamadas de tools
  toolCall(toolName: string, args: any): void {
    this.info(`Tool called: ${toolName}`, { args });
  }

  toolResponse(toolName: string, response: any, duration?: number): void {
    this.info(`Tool response: ${toolName}`, {
      response: typeof response === 'object' ? response : { value: response },
      duration: duration ? `${duration}ms` : undefined
    });
  }

  toolError(toolName: string, error: any): void {
    this.error(`Tool error: ${toolName}`, {
      error: error.message || error,
      stack: error.stack
    });
  }

  // Helper para debugar requisições HTTP
  httpRequest(method: string, url: string, data?: any): void {
    this.debug(`HTTP ${method.toUpperCase()} ${url}`, data);
  }

  httpResponse(method: string, url: string, status: number, data?: any): void {
    this.debug(`HTTP Response ${method.toUpperCase()} ${url} [${status}]`, data);
  }

  httpError(method: string, url: string, error: any): void {
    this.error(`HTTP Error ${method.toUpperCase()} ${url}`, error);
  }
}

// Instância global do debugger
export const mcpDebugger = new MCPDebugger();

// Helper function para medir tempo de execução
export function withTiming<T>(fn: () => Promise<T>, name: string): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now();
    mcpDebugger.debug(`Starting ${name}`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      mcpDebugger.debug(`Completed ${name} in ${duration}ms`);
      resolve(result);
    } catch (error: any) {
      const duration = Date.now() - start;
      mcpDebugger.error(`Failed ${name} after ${duration}ms`, error);
      reject(error);
    }
  });
}
