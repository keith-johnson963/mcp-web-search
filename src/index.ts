#!/usr/bin/env node

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { BraveSearch } from 'brave-search';
import { SafeSearchLevel } from 'brave-search/dist/types.js';
import express from 'express';
import imageToBase64 from 'image-to-base64';
import { formatPoiResults, formatVideoResults } from './utils.js';

const server = new Server(
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

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
}

const braveSearch = new BraveSearch(BRAVE_API_KEY);

const imageByTitle = new Map<string, string>();

const BRAVE_IMAGE_SEARCH_TOOL: Tool = {
  name: 'brave_image_search',
  description: 'Search for images using the Brave Search API',
  inputSchema: {
    type: 'object',
    properties: {
      searchTerm: {
        type: 'string',
        description: 'The term to search the internet for images of',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        default: 1,
        description: 'The number of images to search for, minimum 1, maximum 3',
      },
    },
    required: ['searchTerm'],
  },
};

const searchDescription = 'Performs a web search using the Brave Search API, ideal for general queries, and online content. '
  + 'Use this for broad information gathering, recent events, or when you need diverse web sources. '
  + 'Maximum 20 results per request ';

const BRAVE_WEB_SEARCH_TOOL: Tool = {
  name: 'brave_web_search',
  description: searchDescription,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The term to search the internet for',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        default: 10,
        description: 'The number of results to return',
      },
    },
    required: ['query'],
  },
};

const localSearchDescription = 'Searches for local businesses and places using Brave\'s Local Search API. '
  + 'Best for queries related to physical locations, businesses, restaurants, services, etc. '
  + 'Returns detailed information including:\n'
  + '- Business names and addresses\n'
  + '- Ratings and review counts\n'
  + '- Phone numbers and opening hours\n'
  + 'Use this when the query implies \'near me\' or mentions specific locations. '
  + 'Automatically falls back to web search if no local results are found.';

const BRAVE_LOCAL_SEARCH_TOOL: Tool = {
  name: 'brave_local_search',
  description: localSearchDescription,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Local search query (e.g. \'pizza near Central Park\')',
      },
      count: {
        type: 'number',
        description: 'Number of results (1-20, default 5)',
        minimum: 1,
        maximum: 20,
        default: 5,
      },
    },
    required: ['query'],
  },
};

const newsDescription = 'Searches for news articles using the Brave Search API. '
  + 'Use this for recent events, trending topics, or specific news stories. '
  + 'Returns a list of articles with titles, URLs, and descriptions. '
  + 'Maximum 20 results per request.';

const BRAVE_NEWS_SEARCH_TOOL: Tool = {
  name: 'brave_news_search',
  description: newsDescription,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The term to search the internet for news articles, trending topics, or recent events',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        default: 10,
        description: 'The number of results to return',
      },
    },
    required: ['query'],
  },
};

const videoSearchDescription = 'Searches for videos using the Brave Search API. '
  + 'Use this for video content, tutorials, or any visual media. ';

const BRAVE_VIDEO_SEARCH_TOOL: Tool = {
  name: 'brave_video_search',
  description: videoSearchDescription,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The term to search the internet for videos',
      },
      count: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        default: 10,
        description: 'The number of results to return',
      },
    },
    required: ['query'],
  },
};

// setup request handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    ...Array.from(imageByTitle.keys()).map(title => ({
      uri: `brave-image://${title}`,
      mimeType: 'image/png',
      name: `${title}`,
    })),
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri.toString();
  if (uri.startsWith('brave-image://')) {
    const title = uri.split('://')[1];
    const image = imageByTitle.get(title);
    if (image) {
      return {
        contents: [{
          uri,
          mimeType: 'image/png',
          blob: image,
        }],
      };
    }
  }
  return {
    content: [{ type: 'text', text: `Resource not found: ${uri}` }],
    isError: true,
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [BRAVE_IMAGE_SEARCH_TOOL, BRAVE_WEB_SEARCH_TOOL, BRAVE_LOCAL_SEARCH_TOOL, BRAVE_NEWS_SEARCH_TOOL, BRAVE_VIDEO_SEARCH_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (!args) {
      throw new Error('No arguments provided');
    }
    switch (name) {
      case 'brave_image_search': {
        if (!isImageSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_image_search tool');
        }
        const { searchTerm, count } = args;
        if (count < 1 || count > 3) {
          return { content: [
            {
              type: 'text',
              text: 'count must be less than or equal to 3 and greater than or equal to 1',
            },
          ], isError: true };
        }
        const { titles, base64Strings } = await handleImageSearch(searchTerm, count);
        const results = [];
        for (const [index, title] of titles.entries()) {
          results.push({
            type: 'text',
            text: `${title}`,
          });
          results.push({
            type: 'image',
            data: base64Strings[index],
            mimeType: 'image/png',
          });
        }
        return { content: results };
      }

      case 'brave_web_search': {
        if (!isWebSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_web_search tool');
        }
        const { query, count = 10 } = args;
        const result = await handleWebSearch(query, count);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'brave_local_search': {
        if (!isWebSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_local_search tool');
        }
        const { query, count = 5 } = args;
        const result = await handlePoiSearch(query, count);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'brave_news_search': {
        if (!isWebSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_news_search tool');
        }
        const { query, count = 10 } = args;
        const result = await handleNewsSearch(query, count);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'brave_video_search' : {
        if (!isWebSearchArgs(args)) {
          throw new Error('Invalid arguments for brave_video_search tool');
        }
        const { query, count = 10 } = args;
        const results = await handleVideoSearch(query, count);
        return { content: [{ type: 'text', text: results }] };
      }

      default: {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
    }
  }
  catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

function isImageSearchArgs(args: unknown): args is { searchTerm: string; count: number } {
  return (
    typeof args === 'object'
    && args !== null
    && 'searchTerm' in args
    && typeof (args as { searchTerm: string }).searchTerm === 'string'
    && 'count' in args
    && typeof (args as { count: number }).count === 'number'
  );
}

async function handleImageSearch(searchTerm: string, count: number = 3): Promise<{ titles: string[]; base64Strings: string[] }> {
  log(`Searching for images of "${searchTerm}" with count ${count}`, 'debug');
  try {
    const imageResults = await braveSearch.imageSearch(searchTerm, {
      count,
      safesearch: SafeSearchLevel.Strict,
    });
    log(`Found ${imageResults.results.length} images for "${searchTerm}"`, 'debug');
    const base64Strings = [];
    const titles = [];
    for (const result of imageResults.results) {
      const base64 = await imageToBase64(result.properties.url);
      log(`Image base64 length: ${base64.length}`, 'debug');
      titles.push(result.title);
      base64Strings.push(base64);
      imageByTitle.set(result.title, base64);
    }
    server.notification({
      method: 'notifications/resources/list_changed',
    });
    return { titles, base64Strings };
  }
  catch (error) {
    log(`Error searching for images: ${error}`, 'error');
    throw new Error(`Error searching for images: ${error}`);
  }
}

function isWebSearchArgs(args: unknown): args is { query: string; count?: number } {
  return (
    typeof args === 'object'
    && args !== null
    && 'query' in args
    && typeof (args as { query: string }).query === 'string'
  );
}

async function handleWebSearch(query: string, count: number = 10, offset: number = 0) {
  log(`Searching for "${query}" with count ${count} and offset ${offset}`, 'debug');
  try {
    const results = await braveSearch.webSearch(query, {
      count,
      offset,
      safesearch: SafeSearchLevel.Strict,
    });
    if (!results.web || results.web?.results.length === 0) {
      log(`No results found for "${query}"`);
      return `No results found for "${query}"`;
    }
    return results.web.results.map(result => `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}`).join('\n\n');
  }
  catch (error) {
    log(`Error searching for "${query}": ${error}`, 'error');
    throw new Error(`Error searching for "${query}": ${error}`);
  }
}

async function handlePoiSearch(query: string, count: number = 5) {
  log(`Poi Searching for "${query}" with count ${count}`, 'debug');
  try {
    const results = await braveSearch.webSearch(query, {
      count,
      safesearch: SafeSearchLevel.Strict,
      result_filter: 'locations',
    });
    if (!results.locations || results.locations?.results.length === 0) {
      log(`No location results found for "${query}" falling back to web search. Make sure your API Plan is at least "Pro"`);
      return handleWebSearch(query, count, 0);
    }
    const ids = results.locations.results.map(result => result.id);
    log(`Found ${ids.length} location IDs for "${query}"`, 'debug');
    // Break ids into chunks of 20 (API limit)
    const idChunks = [];
    for (let i = 0; i < ids.length; i += 20) {
      idChunks.push(ids.slice(i, i + 20));
    }
    const formattedText = [];
    for (const idChunk of idChunks) {
      const localPoiSearchApiResponse = await braveSearch.localPoiSearch(idChunk);
      const localDescriptionsSearchApiResponse = await braveSearch.localDescriptionsSearch(idChunk);
      const text = formatPoiResults(localPoiSearchApiResponse, localDescriptionsSearchApiResponse);
      formattedText.push(text);
    }
    return formattedText.join('\n\n') || 'No local results found';
  }
  catch (error) {
    log(`Error searching for "${query}": ${error}`, 'error');
    throw new Error(`Error searching for "${query}": ${error}`);
  }
}

async function handleNewsSearch(query: string, count: number = 10) {
  log(`Searching for news articles with query "${query}" and count ${count}`, 'debug');
  try {
    const newsResult = await braveSearch.newsSearch(query, {
      count,
    });
    if (!newsResult.results || newsResult.results.length === 0) {
      log(`No news results found for "${query}"`);
      return `No news results found for "${query}"`;
    }
    return newsResult.results
      .map(result =>
        `Title: ${result.title}\n`
        + `URL: ${result.url}\n`
        + `Age: ${result.age}\n`
        + `Description: ${result.description}\n`,
      )
      .join('\n\n');
  }
  catch (error) {
    log(`Error searching for news articles with query "${query}": ${error}`, 'error');
    throw new Error(`Error searching for news articles with query "${query}": ${error}`);
  }
}

async function handleVideoSearch(query: string, count: number = 10) {
  log(`Searching for videos with query "${query}" and count ${count}`, 'debug');
  try {
    const videoSearchResults = await braveSearch.videoSearch(query, {
      count,
      safesearch: SafeSearchLevel.Moderate,
    });
    if (!videoSearchResults.results || videoSearchResults.results.length === 0) {
      log(`No video results found for "${query}"`);
      return `No video results found for "${query}"`;
    }
    return formatVideoResults(videoSearchResults.results);
  }
  catch (error) {
    log(`Error searching for videos with query "${query}": ${error}`, 'error');
    throw new Error(`Error searching for videos with query "${query}": ${error}`);
  }
}

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
    if (level === 'error') {
      console.error(message);
    }
    else {
      console.log(message);
    }
  }
  else {
    server.sendLoggingMessage({
      level,
      message,
    });
  }
}

main().catch((error) => {
  console.error('Error in main():', error);
  process.exit(1);
});
