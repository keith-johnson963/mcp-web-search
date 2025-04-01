# Better Brave Search MCP Server

An MCP Server implmentation that integrates the Brave Search API, providing Image Searching capabilities

## Features
- **Image Search**: Search the web for images

## Configuration

### Getting an API Key
1. Sign up for a [Brave Search API account](https://brave.com/search/api/)
2. Choose a plan (Free tier available with 2,000 queries/month)
3. Generate your API key [from the developer dashboard](https://api.search.brave.com/app/keys)

### Install Dependencies and build it
```bash
npm install
```

```bash
npm run build
```

### Usage with Claude Desktop
Add this to your `claude_desktop_config.json`:

```json
"brave-search": {
  "command": "node",
  "args": [
    "C:\\ABSOLUTE\\PATH\\build\\index.js"
  ],
  "env": {
    "BRAVE_API_KEY": "YOUR API KEY HERE"
  }
}
```