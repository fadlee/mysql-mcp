import {
  parseDeleteRowsArgs,
  parseExecuteSqlArgs,
  parseInsertRowArgs,
  parseSelectRowsArgs,
  parseUpdateRowsArgs,
} from '../validators/records.js';
import type { ToolHandlerContext, ToolHandlerMap } from './types.js';

export function createRecordToolHandlers(context: ToolHandlerContext): ToolHandlerMap {
  const { api } = context;

  return {
    select_rows: async (args) => api.selectRows(parseSelectRowsArgs(args)),
    insert_row: async (args) => api.insertRow(parseInsertRowArgs(args)),
    update_rows: async (args) => api.updateRows(parseUpdateRowsArgs(args)),
    delete_rows: async (args) => api.deleteRows(parseDeleteRowsArgs(args)),
    execute_sql: async (args) => api.executeSql(parseExecuteSqlArgs(args)),
  };
}
