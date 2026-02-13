# MySQL MCP Server

Model Context Protocol (MCP) server for MySQL, enabling AI assistants to query and mutate MySQL data safely through tools.

## Features

- 🔧 Tool-based MySQL access (no required env vars)
- 🔐 Runtime authentication via `auth_mysql`
- 🗂️ List databases and tables
- 🧱 Describe table schemas
- 📄 CRUD-like row operations (`select_rows`, `insert_row`, `update_rows`, `delete_rows`)
- 🧾 Custom SQL execution (`execute_sql`) with optional parameters
- 🌐 MCP resources for table schema discovery

## Installation

```bash
npm install @fadlee/mysql-mcp
# or
bun install @fadlee/mysql-mcp
```

## Usage

### With Claude Desktop

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@fadlee/mysql-mcp"]
    }
  }
}
```

### Direct Usage

```bash
npx @fadlee/mysql-mcp
```

## Authentication Flow (via tools)

1. `auth_mysql` (host default `127.0.0.1`, pass user/password and optional host/port/database/ssl)
2. Optional: `use_database` to switch default DB like SQL `USE <db>`
3. `get_auth_status`
4. Use schema/data tools
5. `logout`

No environment variable is required for auth.

## Quick Tutorial

Use prompt-style language like this when chatting with an AI connected to this MCP:

1. "Log in to local MySQL using root with an empty password."
2. "Set the active database to my_app."
3. "Show all tables in the active database."
4. "Describe the users table, including column names and data types."
5. "Fetch the 10 most recent rows from users, ordered by id descending."
6. "Insert one new user into users with email test@example.com."
7. "Update the user with id 1 and set the name to Budi."
8. "Delete the user row with id 1."
9. "Switch the active database to analytics."
10. "Run custom SQL: SELECT id, email FROM users WHERE created_at >= ? with params [\"2026-01-01\"]."

Tip: if you want to run an operation on a specific database without switching the active database, mention the database directly in your prompt, for example: "Fetch 5 rows from analytics.events".

### More Prompt Examples

- Date filters:
  - "Fetch orders from the last 30 days based on created_at."
  - "Show payments between 2026-02-01 and 2026-02-10."
- Pagination:
  - "Fetch 20 users starting from row 21."
  - "Show page 3 of products with 10 rows per page."
- Keyword search:
  - "Find users whose email contains admin."
  - "Fetch posts whose title contains promo."
- Combined filter + sort:
  - "Fetch 10 paid invoices, ordered by id descending."
  - "Show error-level logs, newest first, limited to 50 rows."

## Available Tools

- `health`
- `auth_mysql`
- `get_auth_status`
- `logout`
- `list_databases`
- `use_database`
- `list_tables`
- `describe_table`
- `select_rows`
- `insert_row`
- `update_rows`
- `delete_rows`
- `execute_sql`

## Development

```bash
bun install
bun run dev
bun run typecheck
bun run test
bun run build
```

## License

MIT
