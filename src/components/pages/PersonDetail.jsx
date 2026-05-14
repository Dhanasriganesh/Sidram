import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { formatDateTime, formatMoney } from '../../lib/formatDisplay'
import { createEntry, getPersonIfOwner, listEntries } from '../../services/peopleApi'

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
        <h2 className="text-sm font-semibold text-slate-800">History for this person</h2>
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
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Amount given</th>
                  <th className="px-4 py-3">Interest?</th>
                  <th className="px-4 py-3">Interest %</th>
                  <th className="px-4 py-3">Interest ₹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((row) => (
                  <tr key={row.id} className="text-slate-800">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(row.givenAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatMoney(row.amount)}</td>
                    <td className="px-4 py-3">{row.withInterest ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">{row.withInterest && row.interestPercent != null ? `${row.interestPercent}%` : '—'}</td>
                    <td className="px-4 py-3">{row.withInterest && row.interestAmount != null ? formatMoney(row.interestAmount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default PersonDetail
