/**
 * Total due on one ledger row: principal + interest amount (when interest applies).
 */
export function computeEntryTotalDue(entry) {
  const principal = Number(entry.amount) || 0
  const extra =
    entry.withInterest && entry.interestAmount != null && entry.interestAmount !== undefined
      ? Number(entry.interestAmount) || 0
      : 0
  return principal + extra
}
