import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { formatDateTime, formatMoney } from '../../lib/formatDisplay'
import { computeEntryTotalDue } from '../../lib/loanMath'
import { downloadPersonHistoryExcel } from '../../lib/exportPersonHistory'
import { createEntry, getPersonIfOwner, listEntries, recordEntryPayment } from '../../services/peopleApi'

function toDateTimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  const offsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
}

function PersonDetail() {
  const { personId } = useParams()
  const { user } = useAuth()
  const ready = isFirebaseConfigured() && !!db

  const [person, setPerson] = useState(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [entries, setEntries] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)

  const [givenAtLocal, setGivenAtLocal] = useState(() => toDateTimeLocalValue(new Date()))
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
    setPerson(null)
    setEntries([])
    setNotAllowed(false)
    setPageLoading(true)
    setError('')
    setGivenAtLocal(toDateTimeLocalValue(new Date()))
  }, [personId])

  const loadPerson = useCallback(async () => {
    if (!ready || !user?.uid || !personId) {
      setPerson(null)
      setNotAllowed(false)
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    setNotAllowed(false)
    try {
      const p = await getPersonIfOwner(personId, user.uid)
      if (!p) {
        setPerson(null)
        setNotAllowed(true)
      } else {
        setPerson(p)
      }
    } catch {
      setPerson(null)
      setNotAllowed(true)
    } finally {
      setPageLoading(false)
    }
  }, [ready, user?.uid, personId])

  const loadEntries = useCallback(async () => {
    if (!personId || !person || person.id !== personId) {
      setEntries([])
      setEntriesLoading(false)
      return
    }
    setEntriesLoading(true)
    try {
      const rows = await listEntries(personId)
      setEntries(rows)
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [personId, person])

  useEffect(() => {
    loadPerson()
  }, [loadPerson])

  useEffect(() => {
    if (person) loadEntries()
  }, [person, loadEntries])

  const canUseForm = useMemo(() => ready && !!person && !notAllowed, [ready, person, notAllowed])

  const totalOutstanding = useMemo(() => {
    return entries.reduce((sum, row) => sum + Math.max(0, Number(row.balance) || 0), 0)
  }, [entries])

  function openPaymentModal(row) {
    setPaymentError('')
    setPaymentEntry(row)
    setPaymentAmount('')
    setPaymentPaidAtLocal(toDateTimeLocalValue(new Date()))
  }

  function closePaymentModal() {
    setPaymentEntry(null)
    setPaymentError('')
    setPaymentAmount('')
  }

  function cancelPaymentModal() {
    if (paymentSaving) return
    closePaymentModal()
  }

  async function handleSubmitPayment(e) {
    e.preventDefault()
    setPaymentError('')
    if (!paymentEntry || !personId) return

    const amt = Number.parseFloat(String(paymentAmount).replace(/,/g, ''))
    if (!Number.isFinite(amt) || amt <= 0) {
      setPaymentError('Enter a valid amount greater than zero.')
      return
    }

    const paidDate = new Date(paymentPaidAtLocal)
    if (Number.isNaN(paidDate.getTime())) {
      setPaymentError('Pick a valid date and time for this payment.')
      return
    }

    setPaymentSaving(true)
    try {
      await recordEntryPayment(personId, paymentEntry.id, { amount: amt, paidAt: paidDate })
      closePaymentModal()
      await loadEntries()
    } catch (err) {
      setPaymentError(err?.message || 'Could not save this payment.')
    } finally {
      setPaymentSaving(false)
    }
  }

  async function handleAddEntry(e) {
    e.preventDefault()
    setError('')
    if (!canUseForm || !personId) return

    const amt = Number.parseFloat(String(amount).replace(/,/g, ''))
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than zero.')
      return
    }

    const givenDate = new Date(givenAtLocal)
    if (Number.isNaN(givenDate.getTime())) {
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
      await createEntry(personId, {
        amount: amt,
        givenAt: givenDate,
        withInterest,
        interestPercent: withInterest ? ip : null,
        interestAmount: withInterest ? ia : null,
      })
      setAmount('')
      setWithInterest(false)
      setInterestPercent('')
      setInterestAmount('')
      setGivenAtLocal(toDateTimeLocalValue(new Date()))
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

  if (notAllowed || !person) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">This person was not found, or you do not have access.</p>
        <Link to="/people" className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
          ← Back to people
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/people" className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
          ← All people
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{person.name}</h1>
        <p className="text-sm text-slate-600">Mobile: {person.mobile}</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Below, add each time you give money to this person. You can note interest as a percentage and as a separate amount when applicable.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Record money given</h2>
        <form onSubmit={handleAddEntry} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="given-at" className="block text-sm font-medium text-slate-700">
                Date &amp; time money was given
              </label>
              <input
                id="given-at"
                type="datetime-local"
                required
                value={givenAtLocal}
                onChange={(e) => setGivenAtLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="amount-given" className="block text-sm font-medium text-slate-700">
                Amount given
              </label>
              <input
                id="amount-given"
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
                placeholder="e.g. 10000"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={withInterest}
                onChange={(e) => setWithInterest(e.target.checked)}
                className="mt-1 size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">This amount is with interest</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  If ticked, fill in how much % interest and the interest amount (rupees) for this giving.
                </span>
              </span>
            </label>

            {withInterest && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="interest-pct" className="block text-sm font-medium text-slate-700">
                    Interest (%)
                  </label>
                  <input
                    id="interest-pct"
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestPercent}
                    onChange={(e) => setInterestPercent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <label htmlFor="interest-amt" className="block text-sm font-medium text-slate-700">
                    Interest amount (₹)
                  </label>
                  <input
                    id="interest-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
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
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save this giving'}
          </button>
        </form>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-800">History for this person</h2>
          <button
            type="button"
            disabled={entriesLoading || entries.length === 0}
            onClick={() =>
              downloadPersonHistoryExcel({
                personName: person.name,
                personMobile: person.mobile,
                entries,
              })
            }
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download report
          </button>
        </div>
        {!entriesLoading && entries.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total balance to receive</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totalOutstanding)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Uses the <strong className="font-medium text-slate-700">balance</strong> value stored on each entry in
              Firestore (updated whenever you add a row or record a payment).
            </p>
          </div>
        )}
        {entriesLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading entries…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No entries yet. When you give money, add it using the form above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">When given</th>
                  <th className="px-3 py-3">Given (₹)</th>
                  <th className="hidden px-3 py-3 lg:table-cell">Interest?</th>
                  <th className="hidden px-3 py-3 md:table-cell">Int. %</th>
                  <th className="hidden px-3 py-3 md:table-cell">Int. ₹</th>
                  <th className="px-3 py-3">Total due</th>
                  <th className="px-3 py-3">Paid</th>
                  <th className="px-3 py-3">Balance</th>
                  <th className="px-3 py-3"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((row) => {
                  const totalDue = computeEntryTotalDue(row)
                  const paid = row.totalPaid ?? 0
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
                      <td className="whitespace-nowrap px-3 py-3">{formatMoney(paid)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">
                        <span className={settled ? 'text-emerald-700' : 'text-amber-800'}>
                          {formatMoney(balanceNum)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <button
                          type="button"
                          disabled={settled}
                          onClick={() => openPaymentModal(row)}
                          className="rounded-lg border border-teal-600 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {settled ? 'Settled' : 'Paid'}
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
            if (e.target === e.currentTarget) cancelPaymentModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="payment-dialog-title" className="text-base font-semibold text-slate-900">
              Record amount paid
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Money was given on{' '}
              <span className="font-medium text-slate-800">{formatDateTime(paymentEntry.givenAt)}</span>. Remaining
              balance for this row:{' '}
              <span className="font-semibold text-slate-900">
                {formatMoney(Math.max(0, Number(paymentEntry.balance) || 0))}
              </span>
            </p>
            <form onSubmit={handleSubmitPayment} className="mt-4 space-y-4">
              <div>
                <label htmlFor="pay-amount" className="block text-sm font-medium text-slate-700">
                  Amount received (₹)
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
                  placeholder="e.g. 2000"
                />
              </div>
              <div>
                <label htmlFor="pay-when" className="block text-sm font-medium text-slate-700">
                  When was this amount paid?
                </label>
                <input
                  id="pay-when"
                  type="datetime-local"
                  required
                  value={paymentPaidAtLocal}
                  onChange={(e) => setPaymentPaidAtLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
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
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {paymentSaving ? 'Saving…' : 'Save payment'}
                </button>
                <button
                  type="button"
                  disabled={paymentSaving}
                  onClick={cancelPaymentModal}
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

export default PersonDetail
