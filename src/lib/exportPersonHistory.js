import * as XLSX from 'xlsx'
import { computeEntryTotalDue } from './loanMath'
import { formatDateTime } from './formatDisplay'

const HISTORY_HEADERS = [
  'When given',
  'Given (₹)',
  'Interest?',
  'Int. %',
  'Int. ₹',
  'Total due',
  'Paid',
  'Balance',
]

function entryToRow(row) {
  const totalDue = computeEntryTotalDue(row)
  const paid = row.totalPaid ?? 0
  const balanceNum = Math.max(0, Number(row.balance) || 0)

  return [
    formatDateTime(row.givenAt),
    Number(row.amount) || 0,
    row.withInterest ? 'Yes' : 'No',
    row.withInterest && row.interestPercent != null ? Number(row.interestPercent) : '',
    row.withInterest && row.interestAmount != null ? Number(row.interestAmount) : '',
    totalDue,
    paid,
    balanceNum,
  ]
}

/**
 * @param {{ personName: string, personMobile: string, entries: Array<object> }} options
 */
export function downloadPersonHistoryExcel({ personName, personMobile, entries }) {
  const dataRows = entries.map(entryToRow)
  const totalBalance = entries.reduce((sum, row) => sum + Math.max(0, Number(row.balance) || 0), 0)

  const sheetData = [
    ['Sidram Khaata — Person history'],
    [`Name: ${personName}`],
    [`Mobile: ${personMobile}`],
    [`Exported: ${new Date().toLocaleString('en-IN')}`],
    [],
    HISTORY_HEADERS,
    ...dataRows,
    [],
    ['Total balance to receive', '', '', '', '', '', '', totalBalance],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'History')

  const safeName = (personName || 'person').replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '-') || 'person'
  const datePart = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${safeName}-history-${datePart}.xlsx`)
}
