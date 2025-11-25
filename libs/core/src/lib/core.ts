import type { ColDef, ColGroupDef, IServerSideDatasource } from '@ag-grid-community/core';

export type ColumnDefs = Array<ColDef | ColGroupDef>;

/**
 * The api returns back valueFormatter as an array of expressions instead of a function
 * because functions cannot be returned from an http request.
 * We utilize Angular Expressions to serialize the logic safely.
 * The array of strings allows for multi-line expressions if needed.
 */
export interface SerializedColumnDef extends Omit<ColDef, 'valueFormatter'> {
  /**
   * scope = { _, params, colDef, node, value, moment }
   */
  valueFormatter?: Array<string>;
}

/**
 * Describes how to fetch the table data from the api
 */
export type TableHttpSpec = {
  url: string;
  params?: Record<string, unknown>;
};

/**
 * This is the table definition as it is returned from the api
 */
export type SerializedTableDefinition = {
  http: TableHttpSpec;
  columnDefs: SerializedColumnDef[];
  defaultSort?: { colId: string; sort: 'asc' | 'desc' };
};

/**
 * This is the table definition as it is used by the ag-grid component.
 * It contains the datasource used to fetch the information from the api
 * and the column definitions (hydrated with real functions).
 */
export type TableDefinition = {
  columnDefs: ColumnDefs;
  dataSource: IServerSideDatasource;
  defaultSort?: { colId: string; sort: 'asc' | 'desc' };
};

export function core(): string {
  return 'core';
}
