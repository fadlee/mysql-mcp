import assert from 'node:assert/strict';
import test from 'node:test';

import { MySQLMCPServer } from '../dist/server.js';

function createServerWithMockApi() {
  const server = new MySQLMCPServer();

  server.api = {
    authMySql: async (args) => ({ authenticated: true, ...args, port: args.port ?? 3306 }),
    getAuthStatus: () => ({ authenticated: true, session: { host: 'localhost', user: 'root' } }),
    logout: async () => ({ authenticated: false, message: 'MySQL session cleared' }),
    health: async () => ({ ok: true, authenticated: true, message: 'MySQL connection is healthy' }),
    listDatabases: async () => ({ items: [{ name: 'app_db' }] }),
    useDatabase: async ({ database }) => ({
      authenticated: true,
      database,
      message: `Default database set to ${database}`,
    }),
    listTables: async (database) => ({
      items: [{ database: database ?? 'app_db', name: 'users', type: 'BASE TABLE' }],
    }),
    describeTable: async ({ database, table }) => ({
      database: database ?? 'app_db',
      table,
      columns: [{ name: 'id', dataType: 'bigint', isNullable: false, key: 'PRI', defaultValue: null, extra: 'auto_increment' }],
    }),
    selectRows: async () => ({ items: [{ id: 1, email: 'admin@example.com' }], count: 1 }),
    insertRow: async () => ({ insertedId: 42, affectedRows: 1 }),
    updateRows: async () => ({ affectedRows: 1 }),
    deleteRows: async () => ({ affectedRows: 1 }),
    executeSql: async ({ sql, database }) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return {
          mode: 'query',
          sql,
          database: database ?? 'app_db',
          count: 1,
          items: [{ id: 1, email: 'admin@example.com' }],
        };
      }

      return {
        mode: 'mutation',
        sql,
        database: database ?? 'app_db',
        affectedRows: 1,
        changedRows: 1,
        insertId: 42,
      };
    },
    listResources: async () => [
      {
        uri: 'mysql://table/app_db/users',
        name: 'app_db.users',
        description: 'MySQL table app_db.users',
        mimeType: 'application/json',
      },
    ],
    readResource: async (uri) => ({
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({ table: 'users' }),
    }),
  };

  server.toolHandlers = server.createToolHandlers();
  return server;
}

test('rejects unknown tool names', async () => {
  const server = createServerWithMockApi();
  await assert.rejects(() => server.callTool('not_a_tool', {}), /Unknown tool: not_a_tool/);
});

test('supports auth flow with auth_mysql', async () => {
  const server = createServerWithMockApi();

  const auth = await server.callTool('auth_mysql', {
    host: 'localhost',
    user: 'root',
    password: 'secret',
    database: 'app_db',
  });
  const status = await server.callTool('get_auth_status', {});
  const logout = await server.callTool('logout', {});

  assert.equal(auth.authenticated, true);
  assert.equal(status.authenticated, true);
  assert.equal(logout.authenticated, false);
});

test('validates auth_mysql arguments', async () => {
  const server = createServerWithMockApi();

  await assert.rejects(
    () => server.callTool('auth_mysql', { host: 'localhost', user: 'root' }),
    /Missing required parameter: password/
  );
  await assert.rejects(
    () => server.callTool('auth_mysql', { host: 'localhost', user: 'root', password: 'x', port: 70000 }),
    /port must be between 1 and 65535/
  );

  const emptyPassword = await server.callTool('auth_mysql', {
    host: 'localhost',
    user: 'root',
    password: '',
  });
  assert.equal(emptyPassword.authenticated, true);

  const defaultHost = await server.callTool('auth_mysql', {
    user: 'root',
    password: 'secret',
  });
  assert.equal(defaultHost.host, '127.0.0.1');
});

test('supports schema discovery tools', async () => {
  const server = createServerWithMockApi();

  const databases = await server.callTool('list_databases', {});
  const switched = await server.callTool('use_database', { database: 'app_db' });
  const tables = await server.callTool('list_tables', { database: 'app_db' });
  const describe = await server.callTool('describe_table', { database: 'app_db', table: 'users' });

  assert.equal(databases.items[0].name, 'app_db');
  assert.equal(switched.database, 'app_db');
  assert.equal(tables.items[0].name, 'users');
  assert.equal(describe.table, 'users');
});

test('validates use_database arguments', async () => {
  const server = createServerWithMockApi();

  await assert.rejects(() => server.callTool('use_database', {}), /Missing required parameter: database/);
});

test('supports row operation tools', async () => {
  const server = createServerWithMockApi();

  const selected = await server.callTool('select_rows', { table: 'users', limit: 10 });
  const inserted = await server.callTool('insert_row', { table: 'users', data: { email: 'new@example.com' } });
  const updated = await server.callTool('update_rows', {
    table: 'users',
    data: { email: 'changed@example.com' },
    where: { id: 1 },
  });
  const deleted = await server.callTool('delete_rows', { table: 'users', where: { id: 1 } });
  const sqlQuery = await server.callTool('execute_sql', {
    sql: 'SELECT id, email FROM users WHERE id = ?',
    params: [1],
  });
  const sqlMutation = await server.callTool('execute_sql', {
    sql: 'UPDATE users SET email = ? WHERE id = ?',
    params: ['changed@example.com', 1],
  });

  assert.equal(selected.count, 1);
  assert.equal(inserted.insertedId, 42);
  assert.equal(updated.affectedRows, 1);
  assert.equal(deleted.affectedRows, 1);
  assert.equal(sqlQuery.mode, 'query');
  assert.equal(sqlQuery.count, 1);
  assert.equal(sqlMutation.mode, 'mutation');
  assert.equal(sqlMutation.affectedRows, 1);
});

test('validates row operation arguments', async () => {
  const server = createServerWithMockApi();

  await assert.rejects(
    () => server.callTool('select_rows', { table: 'users', orderBy: 'created_at DOWN' }),
    /orderBy must be in format/
  );
  await assert.rejects(
    () => server.callTool('insert_row', { table: 'users', data: 'invalid' }),
    /Invalid parameter: data must be an object/
  );
  await assert.rejects(
    () => server.callTool('update_rows', { table: 'users', data: { email: 'x' }, where: {} }),
    /where cannot be an empty object/
  );
  await assert.rejects(
    () => server.callTool('delete_rows', { table: 'users' }),
    /Missing required parameter: where/
  );
  await assert.rejects(() => server.callTool('execute_sql', {}), /Missing required parameter: sql/);
  await assert.rejects(
    () => server.callTool('execute_sql', { sql: 'SELECT 1', params: 'invalid' }),
    /Invalid parameter: params must be an array/
  );
});

test('supports MCP resources via server helpers', async () => {
  const server = createServerWithMockApi();

  const resources = await server.listResources();
  const content = await server.readResource('mysql://table/app_db/users');

  assert.equal(resources[0].uri, 'mysql://table/app_db/users');
  assert.equal(content.mimeType, 'application/json');
  assert.match(content.text, /users/);
});
