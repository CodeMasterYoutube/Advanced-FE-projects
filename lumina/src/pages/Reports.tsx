/**
 * src/pages/Reports.tsx
 *
 * Heavy route — imports @tanstack/react-table (~80KB gzipped).
 * Goes into the 'table-vendor' chunk configured in vite.config.ts.
 *
 * Demonstrates:
 *   - Column sorting (click headers)
 *   - Global text filtering
 *   - Status-based filtering
 *   - Client-side pagination
 *   - Proper TypeScript typing with react-table v8
 */

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import type { Transaction } from '../types'

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATUSES = ['completed', 'pending', 'failed'] as const
const COUNTRIES = ['Canada', 'USA', 'UK', 'Australia', 'Germany', 'France', 'Japan']
const PRODUCTS = ['Pro Plan', 'Business Plan', 'Enterprise', 'Starter', 'Add-on Storage', 'API Access']
const CUSTOMERS = [
  'Sarah Chen', 'Marcus Webb', 'Priya Sharma', 'Tom O\'Brien', 'Leila Hassan',
  'James Park', 'Diana Vasquez', 'Ryan Mueller', 'Aisha Patel', 'Lucas Ferreira',
  'Emma Thompson', 'Carlos Reyes', 'Nina Kowalski', 'David Chang', 'Fatima Al-Rashid',
]

function generateTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => {
    const customer = CUSTOMERS[i % CUSTOMERS.length]
    const status = STATUSES[Math.floor(Math.random() * 3)]
    return {
      id: `TXN-${String(10000 + i).padStart(5, '0')}`,
      date: new Date(Date.now() - i * 86400000 * 0.7).toLocaleDateString('en-CA'),
      customer,
      email: `${customer.toLowerCase().replace(/[' ]/g, '.')}@example.com`,
      amount: Math.round((29 + Math.random() * 470) * 100) / 100,
      status,
      country: COUNTRIES[i % COUNTRIES.length],
      product: PRODUCTS[i % PRODUCTS.length],
    }
  })
}

const allTransactions = generateTransactions(80)

// ─── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Transaction>()

const columns = [
  columnHelper.accessor('id', {
    header: 'Transaction ID',
    cell: (info) => (
      <span className="font-mono text-xs text-slate-500">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('date', {
    header: 'Date',
    cell: (info) => <span className="text-slate-600 text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('customer', {
    header: 'Customer',
    cell: (info) => (
      <div>
        <p className="text-sm font-medium text-slate-800">{info.getValue()}</p>
        <p className="text-xs text-slate-400">{info.row.original.email}</p>
      </div>
    ),
  }),
  columnHelper.accessor('product', {
    header: 'Product',
    cell: (info) => <span className="text-sm text-slate-600">{info.getValue()}</span>,
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: (info) => (
      <span className="text-sm font-medium text-slate-800">
        ${info.getValue().toFixed(2)}
      </span>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue()
      const styles = {
        completed: 'bg-emerald-50 text-emerald-700',
        pending:   'bg-amber-50 text-amber-700',
        failed:    'bg-red-50 text-red-600',
      }
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
          {status}
        </span>
      )
    },
    enableSorting: false,
  }),
  columnHelper.accessor('country', {
    header: 'Country',
    cell: (info) => <span className="text-sm text-slate-600">{info.getValue()}</span>,
  }),
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const data = useMemo(() => {
    if (statusFilter === 'all') return allTransactions
    return allTransactions.filter((t) => t.status === statusFilter)
  }, [statusFilter])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">Transaction history and billing records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {totalRows} transactions
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    className={[
                      'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap',
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-700' : '',
                    ].join(' ')}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-slate-300">
                          {header.column.getIsSorted() === 'asc' ? ' ↑'
                            : header.column.getIsSorted() === 'desc' ? ' ↓'
                            : ' ↕'}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}

              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, totalRows)} of {totalRows}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(table.getPageCount(), 5) }, (_, i) => (
              <button
                key={i}
                onClick={() => table.setPageIndex(i)}
                className={[
                  'w-7 h-7 text-xs rounded-md border transition-colors',
                  pageIndex === i
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-200 hover:bg-white',
                ].join(' ')}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
