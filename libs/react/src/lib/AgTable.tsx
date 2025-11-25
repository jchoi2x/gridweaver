import { Component } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { AgGridReactProps } from '@ag-grid-community/react';
import type {
  GridApi,
  GridReadyEvent,
  FirstDataRenderedEvent,
  CellClickedEvent,
  ColumnState,
  ColDef,
  ColGroupDef,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  ValueFormatterParams,
  Module,
} from '@ag-grid-community/core';
import type {
  SerializedColumnDef,
  SerializedTableDefinition,
  ColumnDefs,
} from '@gridweaver/core';
import { expressions } from '@gridweaver/core';

import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-alpine.css';

export type CellRendererAction = (action: string, rowData: unknown) => void;

export interface AgTableProps {
  /** URL to fetch the table definition from */
  url: string;
  /** AG Grid modules to register (e.g., ServerSideRowModelModule) */
  modules?: Module[];
  /** Callback when row selection changes */
  onRowSelectionChanged?: (selectedRows: unknown[]) => void;
  /** Callback when the grid is ready */
  onGridReady?: (params: { gridApi: GridApi }) => void;
  /** Callback when cell editing stops */
  onCellEditingStopped?: (data: unknown) => void;
  /** Callback when a cell renderer action (e.g., from ellipsis menu) is triggered */
  onOptionClicked?: (params: { action: string; rowData: unknown }) => void;
  /** Custom AG Grid props to pass through */
  gridProps?: Partial<AgGridReactProps>;
  /** Height of the grid container */
  height?: string | number;
  /** Custom class name for the container */
  className?: string;
}

interface AgTableState {
  columnDefs: (ColDef | ColGroupDef)[];
  dataSource: IServerSideDatasource | null;
  defaultSort?: { colId: string; sort: 'asc' | 'desc' };
  loading: boolean;
  error: string | null;
}

const DEFAULT_COL_DEF: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
};

/**
 * Parses server-side row model sorting and filtering parameters
 */
function parseSort(params: IServerSideGetRowsParams) {
  const { startRow = 0, endRow = 0 } = params.request;
  const filterModel = params.request.filterModel || {};
  const limit = endRow - startRow;
  const sort: { colId: string; sort: string } =
    params.request.sortModel?.[0] || { colId: 'createdAt', sort: 'desc' };

  const filter = Object.fromEntries(
    Object.entries(filterModel).map(([key, val]: [string, unknown]) => {
      const filterVal = val as { type: string; filter: string };
      let operator = '$eq';
      if (filterVal.type === 'contains') {
        if (key !== 'id') {
          operator = '$iLike';
        }
      }
      if (filterVal.type === 'notContains') {
        if (key !== 'id') {
          operator = '$notILike';
        }
      }
      return [
        key,
        operator === '$eq'
          ? filterVal.filter
          : {
              [operator]: `%${filterVal.filter}%`,
            },
      ];
    })
  );

  let orderBy: unknown = [[sort.colId, sort.sort]];

  if (sort.colId.includes('.')) {
    const [modelName, columnName] = sort.colId.split('.');
    const model = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    orderBy = [
      [
        {
          model,
          as: modelName,
        },
        columnName,
        sort.sort,
      ],
    ];
  }

  return {
    filter,
    limit,
    offset: startRow,
    orderBy,
  };
}

/**
 * Converts serialized columnDefs into AG Grid ColDef and ColGroupDef
 */
function fromSerializedToColumnDef(
  serialized: SerializedColumnDef[],
  cellRendererAction?: CellRendererAction
): ColumnDefs {
  return serialized.map<ColDef | ColGroupDef>((c) => {
    // If the column has a cell renderer, inject the cellRendererAction function
    if ('cellRenderer' in c && cellRendererAction && c.cellRendererParams) {
      c.cellRendererParams = {
        ...c.cellRendererParams,
        onAction: cellRendererAction,
      };
    }

    // Check if valueFormatter is an array of expressions
    if (
      !c.valueFormatter ||
      !Array.isArray(c.valueFormatter) ||
      c.valueFormatter.length === 0
    ) {
      return c as ColDef | ColGroupDef;
    }

    const vf = c.valueFormatter;
    const valueFormatter = (params: ValueFormatterParams) => {
      // Define a scope that the expression has access to
      const scope = {
        api: params.api,
        colDef: params.colDef,
        node: params.node,
        value: params.value,
      };

      let result: unknown;
      for (const exp of vf) {
        const exec = expressions.compile(exp);
        result = exec(scope);
      }
      return result as string;
    };

    return {
      ...c,
      valueFormatter,
    } as ColDef | ColGroupDef;
  });
}

/**
 * AgTable - A dynamic AG Grid component that fetches table definitions from an API
 */
export class AgTable extends Component<AgTableProps, AgTableState> {
  private gridApi: GridApi | null = null;

  constructor(props: AgTableProps) {
    super(props);
    this.state = {
      columnDefs: [],
      dataSource: null,
      defaultSort: undefined,
      loading: true,
      error: null,
    };
  }

  override componentDidMount() {
    this.fetchTableDefinition();
  }

  override componentDidUpdate(prevProps: AgTableProps) {
    if (prevProps.url !== this.props.url) {
      this.fetchTableDefinition();
    }
  }

  private async fetchTableDefinition() {
    const { url, onOptionClicked } = this.props;

    this.setState({ loading: true, error: null });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch table definition: ${response.statusText}`);
      }
      const serialized = (await response.json()) as SerializedTableDefinition;

      const cellRendererAction: CellRendererAction | undefined = onOptionClicked
        ? (action: string, rowData: unknown) => {
            onOptionClicked({ action, rowData });
          }
        : undefined;

      const columnDefs = fromSerializedToColumnDef(serialized.columnDefs, cellRendererAction);

      const dataSource: IServerSideDatasource = {
        getRows: (params: IServerSideGetRowsParams) => {
          const { filter, limit, offset, orderBy } = parseSort(params);

          const queryParams = new URLSearchParams();
          queryParams.set(
            'filter',
            JSON.stringify({
              ...filter,
              ...(serialized.http.params || {}),
            })
          );
          queryParams.set('limit', limit.toString());
          queryParams.set('offset', offset.toString());
          queryParams.set('orderBy', JSON.stringify(orderBy));

          fetch(`${serialized.http.url}?${queryParams.toString()}`)
            .then((res) => res.json() as Promise<{ data: unknown[]; count: number }>)
            .then((result) => {
              params.success({
                rowData: result.data,
                rowCount: result.count,
              });
              params.api.sizeColumnsToFit({});
            })
            .catch(() => {
              params.fail();
            });
        },
      };

      this.setState({
        columnDefs,
        dataSource,
        defaultSort: serialized.defaultSort,
        loading: false,
      });
    } catch (err) {
      this.setState({
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      });
    }
  }

  private sortGrid(field: string, sortDir: 'asc' | 'desc') {
    if (!this.gridApi) return;
    const columnState: ColumnState[] = [
      {
        colId: field,
        sort: sortDir,
      },
    ];
    this.gridApi.applyColumnState({ state: columnState });
  }

  private handleGridReady = (params: GridReadyEvent) => {
    this.gridApi = params.api;

    // Set the server-side datasource
    if (this.state.dataSource) {
      params.api.setGridOption('serverSideDatasource', this.state.dataSource);
    }

    // Apply default sort
    if (this.state.defaultSort) {
      this.sortGrid(this.state.defaultSort.colId, this.state.defaultSort.sort);
    }

    // Restore saved column state from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedState = window.localStorage.getItem(this.props.url);
      if (savedState) {
        try {
          params.api.applyColumnState({ state: JSON.parse(savedState) });
        } catch {
          console.warn('Could not restore saved table state');
        }
      }
    }

    this.props.onGridReady?.({ gridApi: params.api });
  };

  private handleFirstDataRendered = (params: FirstDataRenderedEvent) => {
    params.api.sizeColumnsToFit();
    if (this.state.defaultSort) {
      this.sortGrid(this.state.defaultSort.colId, this.state.defaultSort.sort);
    }
  };

  private handleSelectionChanged = () => {
    if (this.gridApi && this.props.onRowSelectionChanged) {
      const selectedRows = this.gridApi.getSelectedRows();
      this.props.onRowSelectionChanged(selectedRows);
    }
  };

  private handleCellEditingStopped = (event: { data: unknown }) => {
    this.props.onCellEditingStopped?.(event.data);
  };

  private handleColumnChanged = () => {
    if (!this.gridApi) return;
    const savedState = this.gridApi.getColumnState();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(this.props.url, JSON.stringify(savedState));
    }
  };

  private handleCellClicked = (event: CellClickedEvent) => {
    console.log('Cell clicked', event.node.data?.id, event.event);
  };

  /** Get the AG Grid API */
  getGridApi(): GridApi | null {
    return this.gridApi;
  }

  /** Refresh the grid data */
  refreshData() {
    if (this.gridApi && this.state.dataSource) {
      this.gridApi.setGridOption('serverSideDatasource', this.state.dataSource);
    }
  }

  override render() {
    const { height = '500px', className, gridProps, modules } = this.props;
    const { columnDefs, loading, error } = this.state;

    if (loading) {
      return <div className={className}>Loading...</div>;
    }

    if (error) {
      return <div className={className}>Error: {error}</div>;
    }

    const containerStyle = {
      width: '100%',
      height: typeof height === 'number' ? `${height}px` : height,
      minHeight: '61vh',
    };

    return (
      <div className={`ag-theme-alpine ${className || ''}`} style={containerStyle}>
        <AgGridReact
          modules={modules}
          defaultColDef={DEFAULT_COL_DEF}
          columnDefs={columnDefs}
          pagination={true}
          cacheBlockSize={50}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          paginationPageSize={10}
          rowModelType="serverSide"
          headerHeight={45}
          rowHeight={45}
          suppressMovableColumns={true}
          onSelectionChanged={this.handleSelectionChanged}
          onCellEditingStopped={this.handleCellEditingStopped}
          onFirstDataRendered={this.handleFirstDataRendered}
          onGridReady={this.handleGridReady}
          onSortChanged={this.handleColumnChanged}
          onCellClicked={this.handleCellClicked}
          onColumnResized={this.handleColumnChanged}
          onColumnVisible={this.handleColumnChanged}
          onColumnPivotChanged={this.handleColumnChanged}
          onColumnRowGroupChanged={this.handleColumnChanged}
          onColumnValueChanged={this.handleColumnChanged}
          onColumnMoved={this.handleColumnChanged}
          onColumnPinned={this.handleColumnChanged}
          {...gridProps}
        />
      </div>
    );
  }
}

export default AgTable;
