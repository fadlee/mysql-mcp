export interface MySqlAuthArgs {
  host: string;
  port?: number;
  user: string;
  password: string;
  database?: string;
  ssl?: boolean;
}

export interface HealthResponse {
  ok: boolean;
  authenticated: boolean;
  message: string;
  serverTime?: string;
}

export interface DatabaseInfo {
  name: string;
}

export interface UseDatabaseArgs {
  database: string;
}

export interface TableInfo {
  database: string;
  name: string;
  type: string;
}

export interface DescribeTableArgs {
  table: string;
  database?: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  key: string;
  defaultValue: unknown;
  extra: string;
}

export interface SelectRowsArgs {
  table: string;
  database?: string;
  columns?: string[];
  where?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface InsertRowArgs {
  table: string;
  database?: string;
  data: Record<string, unknown>;
}

export interface UpdateRowsArgs {
  table: string;
  database?: string;
  data: Record<string, unknown>;
  where: Record<string, unknown>;
}

export interface DeleteRowsArgs {
  table: string;
  database?: string;
  where: Record<string, unknown>;
}

export interface ExecuteSqlArgs {
  sql: string;
  params?: unknown[];
  database?: string;
}
