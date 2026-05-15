import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { formatMoney } from '../../lib/formatDisplay'
import { getTotalBorrowedOutstanding } from '../../services/borrowedApi'
import { getTotalReceivableOutstanding } from '../../services/peopleApi'

function Home() {
  const { user } = useAuth()
  const firestoreReady = isFirebaseConfigured() && !!db

  const [receivableTotal, setReceivableTotal] = useState(null)
  const [receivableLoading, setReceivableLoading] = useState(false)
  const [borrowedTotal, setBorrowedTotal] = useState(null)
  const [borrowedLoading, setBorrowedLoading] = useState(false)

  const loadSummaries = useCallback(async () => {
    if (!firestoreReady || !user?.uid) {
      setReceivableTotal(null)
      setBorrowedTotal(null)
      return
    }
    setReceivableLoading(true)
    setBorrowedLoading(true)
    try {
      const [receivable, borrowed] = await Promise.all([
        getTotalReceivableOutstanding(user.uid),
        getTotalBorrowedOutstanding(user.uid),
      ])
      setReceivableTotal(receivable)
      setBorrowedTotal(borrowed)
    } catch {
      setReceivableTotal(null)
      setBorrowedTotal(null)
    } finally {
      setReceivableLoading(false)
      setBorrowedLoading(false)
    }
  }, [firestoreReady, user?.uid])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-800">{user?.email}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          <strong className="font-medium text-slate-800">Siddu to be received</strong> — money you gave to others and
          they still owe you. <strong className="font-medium text-slate-800">Siddu to be paid</strong> — money you took
          from others and you still owe them.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Siddu to be received</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Money you <strong className="font-medium text-slate-900">gave to others</strong> is stored under “people” in
            Firestore. Each person has entries: how much you gave, interest if any, what they paid back, and the
            remaining <strong className="font-medium text-slate-900">balance</strong> on each row.
          </p>
          <div className="mt-4 rounded-lg border border-teal-200/80 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total still to receive (all people)
            </p>
            {!firestoreReady ? (
              <p className="mt-1 text-sm text-slate-600">Connect Firebase in .env to see this total.</p>
            ) : receivableLoading ? (
              <p className="mt-1 text-sm text-slate-600">Calculating…</p>
            ) : (
              <p className="mt-1 text-2xl font-semibold text-teal-900">{formatMoney(receivableTotal ?? 0)}</p>
            )}
          </div>
          <div className="mt-4">
            <Link
              to="/people"
              className="inline-flex text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              Open People →
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Siddu to be paid</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Money you <strong className="font-medium text-slate-900">borrowed from others</strong> is stored under
            “borrowedFrom” in Firestore. Each lender has entries: how much you took, interest if any, what you repaid,
            and the remaining <strong className="font-medium text-slate-900">balance</strong> on each row.
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
      </div>
  )
}

export default Home
