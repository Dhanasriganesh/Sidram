import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { isFirebaseConfigured } from '../../firebase/config'

function Home() {
  const { user } = useAuth()
  const firestoreReady = isFirebaseConfigured()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-800">{user?.email}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          Use <strong className="font-medium text-slate-800">People</strong> to add names and mobile numbers, then open each person to record every time you give them money — with date, amount, and optional interest.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/people"
          className="inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
        >
          Go to People
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Database</h2>
        <p className="mt-2 text-sm text-slate-600">
          {firestoreReady
            ? 'Firestore is connected. People are stored in the “people” collection; each person’s money entries are stored under their own sub-collection.'
            : 'Add Firebase keys to .env and restart the dev server.'}
        </p>
      </div>
    </div>
  )
}

export default Home
