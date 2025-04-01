import { FastMCP } from "fastmcp";

const server = new FastMCP({
  name: "Better Brave Search",
  version: "1.0.0",
})

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error("Error: BRAVE_API_KEY environment variable is required");
  process.exit(1);
}

server.start({
  transportType: "stdio"
})