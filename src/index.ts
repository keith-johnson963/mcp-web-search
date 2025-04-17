#!/usr/bin/env node

import process from 'node:process';
import { parseArgs } from 'node:util';
import { BraveMcpServer } from './server.js';

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
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
const portNumber = Number.parseInt(port, 10);
if (Number.isNaN(portNumber)) {
  console.error('Error: Invalid port number');
  process.exit(1);
}

const braveMcpServer = new BraveMcpServer(useSSE, portNumber, BRAVE_API_KEY);
braveMcpServer.start().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
