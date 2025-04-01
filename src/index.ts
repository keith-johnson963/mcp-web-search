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