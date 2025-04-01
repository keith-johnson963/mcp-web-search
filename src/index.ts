import { FastMCP } from "fastmcp";

const server = new FastMCP({
  name: "Better Brave Search",
  version: "1.0.0",
})

server.start({
  transportType: "stdio"
})