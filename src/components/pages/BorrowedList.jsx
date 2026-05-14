import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import {
  createBorrowedLender,
  deleteBorrowedLenderAndEntries,
  listBorrowedFrom,
} from '../../services/borrowedApi'

function BorrowedList() {
  const { user } = useAuth()
  const ready = isFirebaseConfigured() && !!db

  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [lenders, setLenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!ready || !user?.uid) {
      setLenders([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listBorrowedFrom(user.uid)
      setLenders(rows)
    } catch (e) {
      if (e?.code === 'permission-denied') {
        setError(
          'Firestore blocked this request. Publish updated rules from firestore.rules (include borrowedFrom).',
        )
      } else {
        setError(e?.message || 'Could not load records.')
      }
      setLenders([])
    } finally {
      setLoading(false)
    }
  }, [ready, user?.uid])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!ready || !user?.uid) return

    const n = name.trim()
    const m = mobile.trim()
    if (!n || !m) {
      setError('Please enter both name and mobile number.')
      return
    }

    setSaving(true)
    try {
      await createBorrowedLender(user.uid, { name: n, mobile: m })
      setName('')
      setMobile('')
      await load()
    } catch (err) {
      if (err?.code === 'duplicate-mobile') {
        setError('This mobile is already saved for someone you owe. Delete that record first or use another number.')
      } else if (err?.code === 'permission-denied') {
        setError(
          'Missing or insufficient permissions — publish firestore.rules in Firebase Console (borrowedFrom rules).',
        )
      } else {
        setError(err?.message || 'Could not save.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(lender) {
    const ok = window.confirm(
      `Remove ${lender.name} and all “money taken” rows for them? This cannot be undone.`,
    )
    if (!ok || !user?.uid) return

    setError('')
    setDeletingId(lender.id)
    try {
      await deleteBorrowedLenderAndEntries(lender.id, user.uid)
      await load()
    } catch (err) {
      setError(err?.message || 'Could not delete.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Firebase is not set up. Add your keys to <code className="rounded bg-amber-100 px-1">.env</code> and restart the app.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Siddu to be paid</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Track money <strong className="font-medium text-slate-800">you took from others</strong> (you borrowed). For
          each person, open their page to record each time you took money and when you repay them.
        </p>
      </div>

      <section className="rounded-xl border border-amber-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Add someone you borrowed from</h2>
        <p className="mt-1 text-xs text-slate-500">Saved in the Firestore collection “borrowedFrom”.</p>
        <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="lender-name" className="block text-sm font-medium text-slate-700">
              Their name
            </label>
            <input
              id="lender-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
              placeholder="Who lent you money"
              autoComplete="name"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="lender-mobile" className="block text-sm font-medium text-slate-700">
              Their mobile
            </label>
            <input
              id="lender-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-amber-600/20 focus:border-amber-600 focus:ring-2"
              placeholder="Mobile number"
              inputMode="tel"
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-slate-500">Same mobile cannot be added twice in this list.</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800">People you owe</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : lenders.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No one added yet. Add the first person you borrowed from above.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {lenders.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-600">{p.mobile}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/owed-to/${p.id}`}
                    className="inline-flex shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Open record
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === p.id}
                    onClick={() => handleDelete(p)}
                    className="inline-flex shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === p.id ? 'Removing…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default BorrowedList
