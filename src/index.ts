#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { serializeError } from './errors.js';
import { MySQLMCPServer } from './server.js';
import { getToolDefinitions } from './tool-definitions.js';

const mysqlServer = new MySQLMCPServer();

const mcpServer = new McpServer(
  {
    name: 'dynamic-mysql-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

const server = mcpServer.server;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: getToolDefinitions(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await mysqlServer.callTool(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const serialized = serializeError(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: serialized }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = await mysqlServer.listResources();
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    const content = await mysqlServer.readResource(uri);
    return {
      contents: [content],
    };
  } catch (error) {
    const serialized = serializeError(error);
    throw new Error(`[${serialized.type}] ${serialized.message}`);
  }
});

async function main() {
  await mysqlServer.initialize();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
