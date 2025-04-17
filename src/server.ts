import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express from 'express';

export class BraveMcpServer {
  private server: McpServer;

  constructor(private useSSE: boolean, private port: number) {
    this.server = new McpServer(
      {
        name: 'Brave Search MCP Server',
        description: 'A server that provides tools for searching the web, images, videos, and local businesses using the Brave Search API.',
        version: '0.6.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          logging: {},
        },
      },
    );
  }

  public async start() {
    if (this.useSSE) {
      this.log('Running with SSE transport');
      // configure the server to use SSE transport
      let transport: SSEServerTransport | null = null;
      const app = express();
      app.get('/sse', (req: express.Request, res: express.Response) => {
        transport = new SSEServerTransport('/messages', res);
        this.server.connect(transport);
      });

      app.post('/messages', (req: express.Request, res: express.Response) => {
        if (transport) {
          transport.handlePostMessage(req, res);
        }
      });

      app.listen(this.port);
      this.log(`Server is running on port ${this.port} with SSE transport`);
    }
    else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.log('Server is running with Stdio transport');
    }
  }

  public log(
    message: string,
    level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency' = 'info',
  ): void {
    if (this.useSSE) {
      if (level === 'error') {
        console.error(message);
      }
      else {
        console.log(message);
      }
    }
    else {
      this.server.server.sendLoggingMessage({
        level,
        message,
      });
    }
  }
}
