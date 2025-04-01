import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { imageContent } from "fastmcp";
import { BraveSearch } from "brave-search";
import { SafeSearchLevel } from "brave-search/dist/types.js";
import { z } from "zod";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const server = new McpServer({
  name: "Better Brave Search",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

const braveSearch = new BraveSearch(BRAVE_API_KEY)

server.tool(
  "brave_image_search",
  "Search for images using Brave Search",
  {
    searchTerm: z.string().describe("The term to search the internet for images of"),
    count: z.number().min(1).max(3).default(1).describe("The number of images to search for"),
  },
  async ({ searchTerm, count }) => {
    console.log(`Searching for images of "${searchTerm}" with count ${count}`);
    try {
      const imageResults = await braveSearch.imageSearch(searchTerm, {
        count,
        safesearch: SafeSearchLevel.Strict
      })
      // log.info(`Found ${imageResults.results.length} images for "${searchTerm}"`)
      const content = []
      for (const result of imageResults.results) {
        content.push(await imageContent({ url: result.properties.url}))
      } 
      return { content }
    } catch (error) {
      console.error(`Error searching for images: ${error}`)
      return { content: [] }
    }
  }
)

const searchDescription = "Performs a web search using the Brave Search API, ideal for general queries, news, articles, and online content. " +
"Use this for broad information gathering, recent events, or when you need diverse web sources. " +
"Supports pagination, content filtering, and freshness controls. " +
"Maximum 20 results per request, with offset for pagination. "

server.tool(
  "brave_web_search",
  searchDescription,
  {
    query: z.string().describe("The term to search the internet for"),
    count: z.number().min(1).max(20).default(10).describe("The number of results to return"),
    offset: z.number().min(0).max(9).default(0).describe("The offset for pagination"),
  },
  async ({ query, count, offset }) => {
    console.log(`Searching for "${query}" with count ${count} and offset ${offset}`);
    try {
      const results = await braveSearch.webSearch(query, {
        count,
        offset,
        safesearch: SafeSearchLevel.Strict
      })
      if (results.web?.results.length === 0) {
        console.log(`No results found for "${query}"`);
        return { content: [] }
      }
      // log.info(`Found ${results.results.length} results for "${query}"`)
      return {
        content: results.web?.results.map((result) => ({
          type: "text",
          text: `Title: ${result.title}\nURL: ${result.url}\nDescription: ${result.description}`,
        })) || []
      }
    } catch (error) {
      console.error(`Error searching for "${query}": ${error}`)
      return {
        content: [],
        isError: true,
        error: `Error searching for "${query}": ${error}`
      }
    }
  }
)

// configure the server to use SSE transport
let transport: SSEServerTransport | null = null;

app.get("/sse", (req: Request, res: Response) => {
  transport = new SSEServerTransport("/messages", res);
  server.connect(transport);
});

app.post("/messages", (req: Request, res: Response) => {
  if (transport) {
    transport.handlePostMessage(req, res);
  }
});

app.listen(3033);
console.log("Server is running on port 3033");