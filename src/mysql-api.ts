import { ApiError, AuthError, ValidationError } from './errors.js';
import type {
  ColumnInfo,
  DatabaseInfo,
  DeleteRowsArgs,
  DescribeTableArgs,
  ExecuteSqlArgs,
  HealthResponse,
  InsertRowArgs,
  MySqlAuthArgs,
  SelectRowsArgs,
  TableInfo,
  UpdateRowsArgs,
  UseDatabaseArgs,
} from './types.js';
import { createPool, type Pool, type PoolOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

interface AuthSession {
  host: string;
  port: number;
  user: string;
  database: string | null;
  ssl: boolean;
}

export class MySqlApi {
  private pool: Pool | null = null;
  private session: AuthSession | null = null;

  private ensureAuthenticated(): Pool {
    if (!this.pool) {
      throw new AuthError('Not authenticated. Call auth_mysql first.');
    }

    return this.pool;
  }

  private assertIdentifier(value: string, field: string): string {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new ValidationError(
        `Invalid parameter: ${field} must contain only letters, numbers, and underscore`
      );
    }

    return value;
  }

  private escapeIdentifier(value: string, field: string): string {
    return `\`${this.assertIdentifier(value, field)}\``;
  }

  private escapeTableReference(table: string, database?: string): string {
    const escapedTable = this.escapeIdentifier(table, 'table');
    const resolvedDatabase = database ?? this.session?.database ?? undefined;
    if (!resolvedDatabase) {
      throw new ValidationError(
        'No database selected. Call use_database, pass database parameter, or authenticate with a default database.'
      );
    }

    const escapedDatabase = this.escapeIdentifier(resolvedDatabase, 'database');
    return `${escapedDatabase}.${escapedTable}`;
  }

  private resolveDatabase(database?: string): string {
    const resolved = database ?? this.session?.database ?? null;
    if (!resolved) {
      throw new ValidationError(
        'No database selected. Call use_database, pass database parameter, or authenticate with a default database.'
      );
    }

    return this.assertIdentifier(resolved, 'database');
  }

  private buildWhereClause(where?: Record<string, unknown>): { sql: string; values: unknown[] } {
    if (!where || Object.keys(where).length === 0) {
      return { sql: '', values: [] };
    }

    const parts: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(where)) {
      const escapedKey = this.escapeIdentifier(key, `where.${key}`);
      if (value === null) {
        parts.push(`${escapedKey} IS NULL`);
      } else {
        parts.push(`${escapedKey} = ?`);
        values.push(value);
      }
    }

    return {
      sql: ` WHERE ${parts.join(' AND ')}`,
      values,
    };
  }

  async authMySql(args: MySqlAuthArgs): Promise<{
    authenticated: boolean;
    host: string;
    port: number;
    user: string;
    database: string | null;
    ssl: boolean;
  }> {
    if (this.pool) {
      await this.pool.end();
    }

    const options: PoolOptions = {
      host: args.host,
      port: args.port ?? 3306,
      user: args.user,
      password: args.password,
      database: args.database,
      ssl: args.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    };

    try {
      const pool = createPool(options);
      await pool.query('SELECT 1');
      this.pool = pool;
      this.session = {
        host: options.host || args.host,
        port: options.port || 3306,
        user: args.user,
        database: args.database ?? null,
        ssl: Boolean(args.ssl),
      };

      return {
        authenticated: true,
        host: this.session.host,
        port: this.session.port,
        user: this.session.user,
        database: this.session.database,
        ssl: this.session.ssl,
      };
    } catch (error) {
      this.pool = null;
      this.session = null;
      const message = error instanceof Error ? error.message : String(error);
      throw new AuthError(`MySQL authentication failed: ${message}`);
    }
  }

  getAuthStatus() {
    return {
      authenticated: Boolean(this.pool),
      session: this.session,
    };
  }

  async logout(): Promise<{ message: string; authenticated: boolean }> {
    if (this.pool) {
      await this.pool.end();
    }

    this.pool = null;
    this.session = null;

    return {
      message: 'MySQL session cleared',
      authenticated: false,
    };
  }

  async health(): Promise<HealthResponse> {
    if (!this.pool) {
      return {
        ok: false,
        authenticated: false,
        message: 'Not authenticated',
      };
    }

    const pool = this.ensureAuthenticated();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT NOW() AS serverTime');
    return {
      ok: true,
      authenticated: true,
      message: 'MySQL connection is healthy',
      serverTime: String(rows[0]?.serverTime ?? ''),
    };
  }

  async listDatabases(): Promise<{ items: DatabaseInfo[] }> {
    const pool = this.ensureAuthenticated();
    const [rows] = await pool.query<RowDataPacket[]>('SHOW DATABASES');

    return {
      items: rows.map((row) => ({
        name: String(Object.values(row)[0]),
      })),
    };
  }

  async listTables(database?: string): Promise<{ items: TableInfo[] }> {
    const pool = this.ensureAuthenticated();
    const targetDatabase = this.resolveDatabase(database);

    const sql = `
      SELECT TABLE_SCHEMA AS databaseName, TABLE_NAME AS tableName, TABLE_TYPE AS tableType
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [targetDatabase]);

    return {
      items: rows.map((row) => ({
        database: String(row.databaseName),
        name: String(row.tableName),
        type: String(row.tableType),
      })),
    };
  }

  async describeTable(args: DescribeTableArgs): Promise<{
    table: string;
    database: string | null;
    columns: ColumnInfo[];
  }> {
    const pool = this.ensureAuthenticated();
    const table = this.assertIdentifier(args.table, 'table');
    const database = this.resolveDatabase(args.database);

    const sql = `
      SELECT
        COLUMN_NAME AS columnName,
        DATA_TYPE AS dataType,
        IS_NULLABLE AS isNullable,
        COLUMN_KEY AS columnKey,
        COLUMN_DEFAULT AS defaultValue,
        EXTRA AS extra
      FROM information_schema.columns
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const [rows] = await pool.query<RowDataPacket[]>(sql, [database, table]);

    if (rows.length === 0) {
      throw new ApiError(`Table not found: ${table}`);
    }

    return {
      table,
      database,
      columns: rows.map((row) => ({
        name: String(row.columnName),
        dataType: String(row.dataType),
        isNullable: String(row.isNullable).toUpperCase() === 'YES',
        key: String(row.columnKey || ''),
        defaultValue: row.defaultValue,
        extra: String(row.extra || ''),
      })),
    };
  }

  async selectRows(args: SelectRowsArgs): Promise<{ items: RowDataPacket[]; count: number }> {
    const pool = this.ensureAuthenticated();
    const tableRef = this.escapeTableReference(args.table, args.database);

    const columns = args.columns?.length
      ? args.columns.map((column) => this.escapeIdentifier(column, `columns.${column}`)).join(', ')
      : '*';

    const where = this.buildWhereClause(args.where);
    const values: unknown[] = [...where.values];

    let orderBySql = '';
    if (args.orderBy) {
      const [column, direction] = args.orderBy.split(/\s+/);
      orderBySql = ` ORDER BY ${this.escapeIdentifier(column, 'orderBy')}`;
      if (direction) {
        orderBySql += ` ${direction.toUpperCase()}`;
      }
    }

    let limitSql = '';
    if (args.limit !== undefined) {
      limitSql = ' LIMIT ?';
      values.push(args.limit);
    }

    if (args.offset !== undefined) {
      if (args.limit === undefined) {
        throw new ValidationError('Invalid parameter: offset requires limit');
      }
      limitSql += ' OFFSET ?';
      values.push(args.offset);
    }

    const sql = `SELECT ${columns} FROM ${tableRef}${where.sql}${orderBySql}${limitSql}`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, values);

    return {
      items: rows,
      count: rows.length,
    };
  }

  async insertRow(args: InsertRowArgs): Promise<{ insertedId: number; affectedRows: number }> {
    const pool = this.ensureAuthenticated();
    const tableRef = this.escapeTableReference(args.table, args.database);
    const entries = Object.entries(args.data);
    if (entries.length === 0) {
      throw new ValidationError('Invalid parameter: data cannot be empty');
    }

    const columns = entries.map(([key]) => this.escapeIdentifier(key, `data.${key}`)).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    const values = entries.map(([, value]) => value);

    const sql = `INSERT INTO ${tableRef} (${columns}) VALUES (${placeholders})`;
    const [result] = await pool.execute<ResultSetHeader>(sql, values);

    return {
      insertedId: result.insertId,
      affectedRows: result.affectedRows,
    };
  }

  async updateRows(args: UpdateRowsArgs): Promise<{ affectedRows: number }> {
    const pool = this.ensureAuthenticated();
    const tableRef = this.escapeTableReference(args.table, args.database);
    const entries = Object.entries(args.data);
    if (entries.length === 0) {
      throw new ValidationError('Invalid parameter: data cannot be empty');
    }

    const setSql = entries
      .map(([key]) => `${this.escapeIdentifier(key, `data.${key}`)} = ?`)
      .join(', ');
    const setValues = entries.map(([, value]) => value);

    const where = this.buildWhereClause(args.where);
    if (!where.sql) {
      throw new ValidationError('Invalid parameter: where cannot be empty for update_rows');
    }

    const sql = `UPDATE ${tableRef} SET ${setSql}${where.sql}`;
    const [result] = await pool.execute<ResultSetHeader>(sql, [...setValues, ...where.values]);

    return {
      affectedRows: result.affectedRows,
    };
  }

  async deleteRows(args: DeleteRowsArgs): Promise<{ affectedRows: number }> {
    const pool = this.ensureAuthenticated();
    const tableRef = this.escapeTableReference(args.table, args.database);
    const where = this.buildWhereClause(args.where);
    if (!where.sql) {
      throw new ValidationError('Invalid parameter: where cannot be empty for delete_rows');
    }

    const sql = `DELETE FROM ${tableRef}${where.sql}`;
    const [result] = await pool.execute<ResultSetHeader>(sql, where.values);

    return {
      affectedRows: result.affectedRows,
    };
  }

  async executeSql(args: ExecuteSqlArgs): Promise<
    | {
        mode: 'query';
        sql: string;
        database: string | null;
        count: number;
        items: RowDataPacket[];
      }
    | {
        mode: 'mutation';
        sql: string;
        database: string | null;
        affectedRows: number;
        changedRows: number;
        insertId: number;
      }
  > {
    const pool = this.ensureAuthenticated();
    const params = args.params ?? [];

    const connection = await pool.getConnection();
    try {
      let database: string | null = this.session?.database ?? null;
      if (args.database) {
        database = this.assertIdentifier(args.database, 'database');
        await connection.query(`USE ${this.escapeIdentifier(database, 'database')}`);
      }

      const [rows] = await connection.query<RowDataPacket[] | ResultSetHeader>(args.sql, params);
      if (Array.isArray(rows)) {
        return {
          mode: 'query',
          sql: args.sql,
          database,
          count: rows.length,
          items: rows,
        };
      }

      return {
        mode: 'mutation',
        sql: args.sql,
        database,
        affectedRows: rows.affectedRows,
        changedRows: rows.changedRows,
        insertId: rows.insertId,
      };
    } finally {
      connection.release();
    }
  }

  async listResources(): Promise<
    Array<{ uri: string; name: string; description: string; mimeType: string }>
  > {
    const tables = await this.listTables(this.session?.database ?? undefined);

    return tables.items.map((table) => ({
      uri: `mysql://table/${table.database}/${table.name}`,
      name: `${table.database}.${table.name}`,
      description: `MySQL table ${table.database}.${table.name}`,
      mimeType: 'application/json',
    }));
  }

  async useDatabase(args: UseDatabaseArgs): Promise<{
    message: string;
    database: string;
    authenticated: boolean;
  }> {
    const pool = this.ensureAuthenticated();
    const database = this.assertIdentifier(args.database, 'database');

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT SCHEMA_NAME AS name FROM information_schema.schemata WHERE SCHEMA_NAME = ?',
      [database]
    );

    if (rows.length === 0) {
      throw new ApiError(`Database not found: ${database}`);
    }

    if (!this.session) {
      throw new AuthError('Not authenticated. Call auth_mysql first.');
    }

    this.session = {
      ...this.session,
      database,
    };

    return {
      message: `Default database set to ${database}`,
      database,
      authenticated: true,
    };
  }

  async readResource(uri: string): Promise<{ uri: string; mimeType: string; text: string }> {
    const match = uri.match(/^mysql:\/\/table\/([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new ValidationError('Invalid resource URI');
    }

    const [, database, table] = match;
    const result = await this.describeTable({ database, table });

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(result, null, 2),
    };
  }
}
