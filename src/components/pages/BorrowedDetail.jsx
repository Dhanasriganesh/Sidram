import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { formatDateTime, formatMoney } from '../../lib/formatDisplay'
import { computeEntryTotalDue } from '../../lib/loanMath'
import {
  createBorrowedEntry,
  getBorrowedLenderIfOwner,
  listBorrowedEntries,
  recordBorrowedRepayment,
} from '../../services/borrowedApi'

function toDateTimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  const offsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
}

function BorrowedDetail() {
  const { lenderId } = useParams()
  const { user } = useAuth()
  const ready = isFirebaseConfigured() && !!db

  const [lender, setLender] = useState(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [entries, setEntries] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)

  const [takenAtLocal, setTakenAtLocal] = useState(() => toDateTimeLocalValue(new Date()))
  const [amount, setAmount] = useState('')
  const [withInterest, setWithInterest] = useState(false)
  const [interestPercent, setInterestPercent] = useState('')
  const [interestAmount, setInterestAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [paymentEntry, setPaymentEntry] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentPaidAtLocal, setPaymentPaidAtLocal] = useState(() => toDateTimeLocalValue(new Date()))
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    setLender(null)
    setEntries([])
    setNotAllowed(false)
    setPageLoading(true)
    setError('')
    setTakenAtLocal(toDateTimeLocalValue(new Date()))
  }, [lenderId])

  const loadLender = useCallback(async () => {
    if (!ready || !user?.uid || !lenderId) {
      setLender(null)
      setNotAllowed(false)
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    setNotAllowed(false)
    try {
      const p = await getBorrowedLenderIfOwner(lenderId, user.uid)
      if (!p) {
        setLender(null)
        setNotAllowed(true)
      } else {
        setLender(p)
      }
    } catch {
      setLender(null)
      setNotAllowed(true)
    } finally {
      setPageLoading(false)
    }
  }, [ready, user?.uid, lenderId])

  const loadEntries = useCallback(async () => {
    if (!lenderId || !lender || lender.id !== lenderId) {
      setEntries([])
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    try {
      const rows = await listBorrowedEntries(lenderId)
      setEntries(rows)
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [lenderId, lender])

  useEffect(() => {
    loadLender()
  }, [loadLender])

  useEffect(() => {
    if (lender) loadEntries()
  }, [lender, loadEntries])

  const canUseForm = useMemo(() => ready && !!lender && !notAllowed, [ready, lender, notAllowed])

  const totalOwedHere = useMemo(() => {
    return entries.reduce((sum, row) => sum + Math.max(0, Number(row.balance) || 0), 0)
  }, [entries])

  function openRepayModal(row) {
    setPaymentError('')
    setPaymentEntry(row)
    setPaymentAmount('')
    setPaymentPaidAtLocal(toDateTimeLocalValue(new Date()))
  }

  function closeRepayModal() {
    setPaymentEntry(null)
    setPaymentError('')
    setPaymentAmount('')
  }

  function cancelRepayModal() {
    if (paymentSaving) return
    closeRepayModal()
  }

  async function handleSubmitRepayment(e) {
    e.preventDefault()
    setPaymentError('')
    if (!paymentEntry || !lenderId) return

    const amt = Number.parseFloat(String(paymentAmount).replace(/,/g, ''))
    if (!Number.isFinite(amt) || amt <= 0) {
      setPaymentError('Enter a valid amount greater than zero.')
      return
    }

    const paidDate = new Date(paymentPaidAtLocal)
    if (Number.isNaN(paidDate.getTime())) {
      setPaymentError('Pick a valid date and time.')
      return
    }

    setPaymentSaving(true)
    try {
      await recordBorrowedRepayment(lenderId, paymentEntry.id, { amount: amt, paidAt: paidDate })
      closeRepayModal()
      await loadEntries()
    } catch (err) {
      setPaymentError(err?.message || 'Could not save this repayment.')
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault()
    setError('')
    if (!canUseForm || !lenderId) return

    const amt = Number.parseFloat(String(amount).replace(/,/g, ''))
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }

    const takenDate = new Date(takenAtLocal)
    if (Number.isNaN(takenDate.getTime())) {
      setError('Pick a valid date and time.')
      return
    }

    let ip = null
    let ia = null
    if (withInterest) {
      ip = Number.parseFloat(String(interestPercent).replace(/,/g, ''))
      ia = Number.parseFloat(String(interestAmount).replace(/,/g, ''))
      if (!Number.isFinite(ip) || ip < 0) {
        setError('Enter interest % (0 or more).')
        return
      }
      if (!Number.isFinite(ia) || ia < 0) {
        setError('Enter interest amount (0 or more).')
        return
      }
    }

    setSaving(true)
    try {
      await createBorrowedEntry(lenderId, {
        amount: amt,
        givenAt: takenDate,
        withInterest,
        interestPercent: withInterest ? ip : null,
        interestAmount: withInterest ? ia : null,
      })
      setAmount('')
      setWithInterest(false)
      setInterestPercent('')
      setInterestAmount('')
      setTakenAtLocal(toDateTimeLocalValue(new Date()))
      await loadEntries()
    } catch (err) {
      setError(err?.message || 'Could not save this entry.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Firebase is not set up. Add your keys to <code className="rounded bg-amber-100 px-1">.env</code> and restart the app.
      </div>
    )
  }

  if (pageLoading) {
    return <p className="text-sm text-slate-600">Loading…</p>
  }

  if (notAllowed || !lender) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">This record was not found, or you do not have access.</p>
        <Link to="/owed-to" className="text-sm font-medium text-amber-800 underline-offset-2 hover:underline">
          ← Siddu to be paid
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/owed-to" className="text-sm font-medium text-amber-800 underline-offset-2 hover:underline">
          ← Siddu to be paid
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{lender.name}</h1>
        <p className="text-sm text-slate-600">Mobile: {lender.mobile}</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Record each time you <strong className="font-medium text-slate-700">took money</strong> from this person.
          When you pay them back, use <strong className="font-medium text-slate-700">Repay</strong> on each row.
        </p>
      </div>

      <section className="rounded-xl border border-amber-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Record money you took</h2>
        <form onSubmit={handleAddEntry} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="taken-at" className="block text-sm font-medium text-slate-700">
                Date &amp; time you took the money
              </label>
              <input
                id="taken-at"
                type="datetime-local"
                required
                value={takenAtLocal}
                onChange={(e) => setTakenAtLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="amount-taken" className="block text-sm font-medium text-slate-700">
                Amount you took (₹)
              </label>
              <input
                id="amount-taken"
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
                placeholder="e.g. 10000"
              />
            </div>
          </div>

          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={withInterest}
                onChange={(e) => setWithInterest(e.target.checked)}
                className="mt-1 size-4 rounded border-slate-300 text-amber-700 focus:ring-amber-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">This borrowing has interest</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  If ticked, enter interest % and interest amount (rupees) for this loan.
                </span>
              </span>
            </label>

            {withInterest && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="b-interest-pct" className="block text-sm font-medium text-slate-700">
                    Interest (%)
                  </label>
                  <input
                    id="b-interest-pct"
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestPercent}
                    onChange={(e) => setInterestPercent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <label htmlFor="b-interest-amt" className="block text-sm font-medium text-slate-700">
                    Interest amount (₹)
                  </label>
                  <input
                    id="b-interest-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !canUseForm}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save this borrowing'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800">History — what you still owe</h2>
        {!entriesLoading && entries.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Total still owed to this person</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totalOwedHere)}</p>
            <p className="mt-1 text-xs text-slate-600">
              Uses the <strong className="font-medium text-slate-800">balance</strong> field stored on each entry in
              Firestore.
            </p>
          </div>
        )}
        {entriesLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No entries yet. When you take money from this person, add it using the form above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">When taken</th>
                  <th className="px-3 py-3">Taken (₹)</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Interest?</th>
                  <th className="hidden px-3 py-3 md:table-cell">Int. %</th>
                  <th className="hidden px-3 py-3 md:table-cell">Int. ₹</th>
                  <th className="px-3 py-3">Total due</th>
                  <th className="px-3 py-3">Repaid</th>
                  <th className="px-3 py-3">Balance</th>
                  <th className="px-3 py-3"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((row) => {
                  const totalDue = computeEntryTotalDue(row)
                  const repaid = row.totalPaid ?? 0
                  const balanceNum = Math.max(0, Number(row.balance) || 0)
                  const settled = balanceNum <= 0.001
                  return (
                    <tr key={row.id} className="text-slate-800">
                      <td className="whitespace-nowrap px-3 py-3">{formatDateTime(row.givenAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{formatMoney(row.amount)}</td>
                      <td className="hidden px-3 py-3 lg:table-cell">{row.withInterest ? 'Yes' : 'No'}</td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        {row.withInterest && row.interestPercent != null ? `${row.interestPercent}%` : '—'}
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        {row.withInterest && row.interestAmount != null ? formatMoney(row.interestAmount) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{formatMoney(totalDue)}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatMoney(repaid)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">
                        <span className={settled ? 'text-emerald-700' : 'text-amber-900'}>
                          {formatMoney(balanceNum)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <button
                          type="button"
                          disabled={settled}
                          onClick={() => openRepayModal(row)}
                          className="rounded-lg border border-amber-600 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {settled ? 'Settled' : 'Repay'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paymentEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelRepayModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="repay-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="repay-dialog-title" className="text-base font-semibold text-slate-900">
              Record repayment
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              You took money on{' '}
              <span className="font-medium text-slate-800">{formatDateTime(paymentEntry.givenAt)}</span>. Remaining
              balance on this row:{' '}
              <span className="font-semibold text-slate-900">
                {formatMoney(Math.max(0, Number(paymentEntry.balance) || 0))}
              </span>
            </p>
            <form onSubmit={handleSubmitRepayment} className="mt-4 space-y-4">
              <div>
                <label htmlFor="repay-amount" className="block text-sm font-medium text-slate-700">
                  Amount you repaid (₹)
                </label>
                <input
                  id="repay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
                  placeholder="e.g. 2000"
                />
              </div>
              <div>
                <label htmlFor="repay-when" className="block text-sm font-medium text-slate-700">
                  When did you repay?
                </label>
                <input
                  id="repay-when"
                  type="datetime-local"
                  required
                  value={paymentPaidAtLocal}
                  onChange={(e) => setPaymentPaidAtLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
                />
              </div>
              {paymentError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {paymentError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
                >
                  {paymentSaving ? 'Saving…' : 'Save repayment'}
                </button>
                <button
                  type="button"
                  disabled={paymentSaving}
                  onClick={cancelRepayModal}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default BorrowedDetail
