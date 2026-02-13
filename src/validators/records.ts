import type {
  DeleteRowsArgs,
  ExecuteSqlArgs,
  InsertRowArgs,
  SelectRowsArgs,
  UpdateRowsArgs,
} from '../types.js';
import {
  assertStringArray,
  optionalInteger,
  optionalString,
  requireObject,
  requireString,
  type UnknownObject,
} from './common.js';
import { parseOrderBy } from './collections.js';
import { ValidationError } from '../errors.js';

function parseWhere(value: unknown, parameter: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const where = requireObject(value, parameter);
  if (Object.keys(where).length === 0) {
    throw new ValidationError(`Invalid parameter: ${parameter} cannot be an empty object`);
  }

  return where;
}

export function parseSelectRowsArgs(args: UnknownObject): SelectRowsArgs {
  const parsed: SelectRowsArgs = {
    table: requireString(args.table, 'table'),
  };

  const database = optionalString(args.database, 'database');
  if (database !== undefined) {
    parsed.database = database;
  }

  if (args.columns !== undefined) {
    assertStringArray(args.columns, 'columns');
    parsed.columns = args.columns;
  }

  const where = parseWhere(args.where, 'where');
  if (where) {
    parsed.where = where;
  }

  const orderBy = optionalString(args.orderBy, 'orderBy');
  if (orderBy !== undefined) {
    parsed.orderBy = parseOrderBy(orderBy);
  }

  const limit = optionalInteger(args.limit, 'limit');
  if (limit !== undefined) {
    if (limit < 1) {
      throw new ValidationError('Invalid parameter: limit must be greater than 0');
    }
    parsed.limit = limit;
  }

  const offset = optionalInteger(args.offset, 'offset');
  if (offset !== undefined) {
    if (offset < 0) {
      throw new ValidationError('Invalid parameter: offset must be 0 or greater');
    }
    parsed.offset = offset;
  }

  return parsed;
}

export function parseInsertRowArgs(args: UnknownObject): InsertRowArgs {
  return {
    table: requireString(args.table, 'table'),
    database: optionalString(args.database, 'database'),
    data: requireObject(args.data, 'data'),
  };
}

export function parseUpdateRowsArgs(args: UnknownObject): UpdateRowsArgs {
  const where = requireObject(args.where, 'where');
  if (Object.keys(where).length === 0) {
    throw new ValidationError('Invalid parameter: where cannot be an empty object');
  }

  return {
    table: requireString(args.table, 'table'),
    database: optionalString(args.database, 'database'),
    data: requireObject(args.data, 'data'),
    where,
  };
}

export function parseDeleteRowsArgs(args: UnknownObject): DeleteRowsArgs {
  const where = requireObject(args.where, 'where');
  if (Object.keys(where).length === 0) {
    throw new ValidationError('Invalid parameter: where cannot be an empty object');
  }

  return {
    table: requireString(args.table, 'table'),
    database: optionalString(args.database, 'database'),
    where,
  };
}

export function parseExecuteSqlArgs(args: UnknownObject): ExecuteSqlArgs {
  const parsed: ExecuteSqlArgs = {
    sql: requireString(args.sql, 'sql'),
  };

  const database = optionalString(args.database, 'database');
  if (database !== undefined) {
    parsed.database = database;
  }

  if (args.params !== undefined) {
    if (!Array.isArray(args.params)) {
      throw new ValidationError('Invalid parameter: params must be an array');
    }

    parsed.params = args.params;
  }

  return parsed;
}
