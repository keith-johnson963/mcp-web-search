import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BraveSearch } from 'brave-search';
import express from 'express';
import { BraveImageSearchTool } from './tools/BraveImageSearchTool.js';
import { BraveLocalSearchTool } from './tools/BraveLocalSearchTool.js';
import { BraveNewsSearchTool } from './tools/BraveNewsSearchTool.js';
import { BraveWebSearchTool } from './tools/BraveWebSearchTool.js';

export class BraveMcpServer {
  private server: McpServer;
  private braveSearch: BraveSearch;
  private imageSearchTool: BraveImageSearchTool;
  private webSearchTool: BraveWebSearchTool;
  private localSearchTool: BraveLocalSearchTool;
  private newsSearchTool: BraveNewsSearchTool;

  constructor(private useSSE: boolean, private port: number, private braveSearchApiKey: string) {
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
    this.braveSearch = new BraveSearch(braveSearchApiKey);
    this.imageSearchTool = new BraveImageSearchTool(this, this.braveSearch);
    this.webSearchTool = new BraveWebSearchTool(this, this.braveSearch);
    this.localSearchTool = new BraveLocalSearchTool(this, this.braveSearch, this.webSearchTool);
    this.newsSearchTool = new BraveNewsSearchTool(this, this.braveSearch);
    this.setupTools();
  }

  private setupTools(): void {
    this.server.tool(
      this.imageSearchTool.name,
      this.imageSearchTool.description,
      this.imageSearchTool.inputSchema.shape,
      this.imageSearchTool.execute.bind(this.imageSearchTool),
    );
    this.server.tool(
      this.webSearchTool.name,
      this.webSearchTool.description,
      this.webSearchTool.inputSchema.shape,
      this.webSearchTool.execute.bind(this.webSearchTool),
    );
    this.server.tool(
      this.localSearchTool.name,
      this.localSearchTool.description,
      this.localSearchTool.inputSchema.shape,
      this.localSearchTool.execute.bind(this.localSearchTool),
    );
    this.server.tool(
      this.newsSearchTool.name,
      this.newsSearchTool.description,
      this.newsSearchTool.inputSchema.shape,
      this.newsSearchTool.execute.bind(this.newsSearchTool),
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

  public resourceChangedNotification() {
    this.server.server.notification({
      method: 'notifications/resources/list_changed',
    });
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
