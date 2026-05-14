import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { formatMoney } from '../../lib/formatDisplay'
import { getTotalBorrowedOutstanding } from '../../services/borrowedApi'

function Home() {
  const { user } = useAuth()
  const firestoreReady = isFirebaseConfigured() && !!db

  const [borrowedTotal, setBorrowedTotal] = useState(null)
  const [borrowedLoading, setBorrowedLoading] = useState(false)

  const loadBorrowedSummary = useCallback(async () => {
    if (!firestoreReady || !user?.uid) {
      setBorrowedTotal(null)
      return
    }
    setBorrowedLoading(true)
    try {
      const t = await getTotalBorrowedOutstanding(user.uid)
      setBorrowedTotal(t)
    } catch {
      setBorrowedTotal(null)
    } finally {
      setBorrowedLoading(false)
    }
  }, [firestoreReady, user?.uid])

  useEffect(() => {
    loadBorrowedSummary()
  }, [loadBorrowedSummary])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-800">{user?.email}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Use <strong className="font-medium text-slate-800">People</strong> when you <em>give</em> money to someone.
          Use <strong className="font-medium text-slate-800">Siddu to be paid</strong> when you <em>took</em> money from
          someone and need to track what you still owe.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/people"
          className="inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
        >
          Go to People
        </Link>
        <Link
          to="/owed-to"
          className="inline-flex rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-800"
        >
          Siddu to be paid
        </Link>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Siddu to be paid</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          Money you <strong className="font-medium text-slate-900">borrowed from others</strong> is stored under
          “borrowedFrom” in Firestore. Each lender has their own entries: how much you took, interest if any, what you
          have repaid, and the remaining <strong className="font-medium text-slate-900">balance</strong> saved on each
          row.
        </p>
        <div className="mt-4 rounded-lg border border-amber-200/80 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total you still owe (all lenders)</p>
          {!firestoreReady ? (
            <p className="mt-1 text-sm text-slate-600">Connect Firebase in .env to see this total.</p>
          ) : borrowedLoading ? (
            <p className="mt-1 text-sm text-slate-600">Calculating…</p>
          ) : (
            <p className="mt-1 text-2xl font-semibold text-amber-950">{formatMoney(borrowedTotal ?? 0)}</p>
          )}
        </div>
        <div className="mt-4">
          <Link
            to="/owed-to"
            className="inline-flex text-sm font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            Open Siddu to be paid →
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Home
