import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const TOOL_DEFINITIONS = [
  {
    name: 'health',
    description: 'Check MySQL connection health and auth state',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'auth_mysql',
    description: 'Authenticate to MySQL using host/user/password credentials',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'MySQL host (default: 127.0.0.1)',
        },
        port: {
          type: 'integer',
          description: 'MySQL port (default: 3306)',
        },
        user: {
          type: 'string',
          description: 'MySQL username',
        },
        password: {
          type: 'string',
          description: 'MySQL password',
        },
        database: {
          type: 'string',
          description: 'Default database/schema (optional)',
        },
        ssl: {
          type: 'boolean',
          description: 'Enable TLS connection',
        },
      },
      required: ['user', 'password'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_auth_status',
    description: 'Check current MySQL authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'logout',
    description: 'Clear current MySQL authentication session',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_databases',
    description: 'List databases available to current MySQL user',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'use_database',
    description: 'Set default database for this MCP session (like USE database)',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name to use by default',
        },
      },
      required: ['database'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tables',
    description: 'List tables in a database (or current database)',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'describe_table',
    description: 'Describe table columns and schema details',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
      },
      required: ['table'],
      additionalProperties: false,
    },
  },
  {
    name: 'select_rows',
    description: 'Select rows with optional where/order/limit filters',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        columns: {
          type: 'array',
          description: 'Columns to select (default: all)',
          items: { type: 'string' },
        },
        where: {
          type: 'object',
          description: 'Exact-match filters object (AND semantics)',
        },
        orderBy: {
          type: 'string',
          description: 'Order expression: "column" or "column ASC|DESC"',
        },
        limit: {
          type: 'integer',
          description: 'Maximum row count',
        },
        offset: {
          type: 'integer',
          description: 'Offset (requires limit)',
        },
      },
      required: ['table'],
      additionalProperties: false,
    },
  },
  {
    name: 'insert_row',
    description: 'Insert a single row into a table',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        data: {
          type: 'object',
          description: 'Column-value object to insert',
        },
      },
      required: ['table', 'data'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_rows',
    description: 'Update rows by exact-match where filters',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        data: {
          type: 'object',
          description: 'Columns to update',
        },
        where: {
          type: 'object',
          description: 'Exact-match filters object (required)',
        },
      },
      required: ['table', 'data', 'where'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_rows',
    description: 'Delete rows by exact-match where filters',
    inputSchema: {
      type: 'object',
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional)',
        },
        table: {
          type: 'string',
          description: 'Table name',
        },
        where: {
          type: 'object',
          description: 'Exact-match filters object (required)',
        },
      },
      required: ['table', 'where'],
      additionalProperties: false,
    },
  },
  {
    name: 'execute_sql',
    description: 'Execute custom SQL with optional positional parameters',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL statement to execute',
        },
        params: {
          type: 'array',
          description: 'Positional values for SQL placeholders (?)',
          items: {},
        },
        database: {
          type: 'string',
          description: 'Database name (optional, overrides current session database for this call)',
        },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
] as const satisfies readonly Tool[];

export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

export function getToolDefinitions(): Tool[] {
  return [...TOOL_DEFINITIONS];
}
