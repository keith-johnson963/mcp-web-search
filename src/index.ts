import type { Request, Response } from 'express';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BraveSearch } from 'brave-search';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import express from 'express';
import imageToBase64 from 'image-to-base64';
import { z } from 'zod';

const server = new McpServer(
  {
    name: 'Better Brave Search',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      logging: {},
    },
  },
);

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
}

const braveSearch = new BraveSearch(BRAVE_API_KEY);

server.tool(
  'brave_image_search',
  'Search for images using Brave Search',
  {
    searchTerm: z.string().describe('The term to search the internet for images of'),
    count: z.number().min(1).max(3).default(1).describe('The number of images to search for'),
  },
  async ({ searchTerm, count }) => {
    log(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');
    try {
      const imageResults = await braveSearch.imageSearch(searchTerm, {
        count,
        safesearch: SafeSearchLevel.Strict,
      });
      log(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
      const content = [];
      for (const result of imageResults.results) {
        const base64 = await imageToBase64(result.properties.url);
        log(`Image base64 length: ${base64.length}`, 'debug');
        content.push({
          type: 'image' as const,
          data: base64,
          mimeType: 'image/png',
        });
      }
      return { content };
    }
    catch (error) {
      console.error(`Error searching for images: ${error}`);
      return {
        content: [],
        isError: true,
        error: `Error searching for images: ${error}`,
      };
    }
  },
);

const searchDescription = 'Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. '
  + 'Use this for broad information gathering, recent events, or when you need diverse web sources. '
  + 'Supports pagination, content filtering, and freshness controls. '
  + 'Maximum 20 results per request, with offset for pagination. ';

server.tool(
  'brave_web_search',
  searchDescription,
  {
    query: z.string().describe('The term to search the internet for'),
    count: z.number().min(1).max(20).default(10).describe('The number of results to return'),
    offset: z.number().min(0).max(9).default(0).describe('The offset for pagination'),
  },
  async ({ query, count, offset }) => {
    log(`Searching for "${query}" with count ${count} and offset ${offset}`, 'debug');
    try {
      const results = await braveSearch.webSearch(query, {
        count,
        offset,
        safesearch: SafeSearchLevel.Strict,
      });
      if (results.web?.results.length === 0) {
        log(`No results found for "${query}"`);
        return { content: [] };
      }
      return {
        content: results.web?.results.map(result => ({
          type: 'text',
          text: `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}`,
        })) || [],
      };
    }
    catch (error) {
      console.error(`Error searching for "${query}": ${error}`);
      return {
        content: [],
        isError: true,
        error: `Error searching for "${query}": ${error}`,
      };
    }
  },
);

// Parse command line arguments
const { values: { useSSE, port } } = parseArgs({
  options: {
    useSSE: {
      type: 'boolean',
      default: false,
    },
    port: {
      type: 'string',
      default: '3033',
    },
  },
});

async function main() {
  if (useSSE) {
    log('Running with SSE transport');
    const portInt = Number.parseInt(port, 10);
    if (Number.isNaN(portInt)) {
      console.error(`Invalid port number: ${port}`);
      process.exit(1);
    }
    // configure the server to use SSE transport
    let transport: SSEServerTransport | null = null;
    const app = express();
    app.get('/sse', (req: Request, res: Response) => {
      transport = new SSEServerTransport('/messages', res);
      server.connect(transport);
    });

    app.post('/messages', (req: Request, res: Response) => {
      if (transport) {
        transport.handlePostMessage(req, res);
      }
    });

    app.listen(portInt);
    log(`Server is running on port ${portInt} with SSE transport`);
  }
  else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('Server is running with Stdio transport');
  }
}

function log(
  message: string,
  level: 'error' | 'debug' | 'info' | 'notice' | 'warning' | 'critical' | 'alert' | 'emergency' = 'info',
) {
  if (useSSE) {
    console.log(message);
  }
  else {
    server.server.sendLoggingMessage({
      level,
      message,
    });
  }
}

main().catch((error) => {
  console.error('Error in main():', error);
  process.exit(1);
});
