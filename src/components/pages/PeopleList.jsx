import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { db, isFirebaseConfigured } from '../../firebase/config'
import { createPerson, listPeople } from '../../services/peopleApi'

function PeopleList() {
  const { user } = useAuth()
  const ready = isFirebaseConfigured() && !!db

  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!ready || !user?.uid) {
      setPeople([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listPeople(user.uid)
      setPeople(rows)
    } catch (e) {
      if (e?.code === 'permission-denied') {
        setError(
          'Firestore blocked this request. Publish the rules from the file firestore.rules (Firebase Console → Firestore → Rules), or run: npm run deploy:firestore',
        )
      } else {
        setError(e?.message || 'Could not load people.')
      }
      setPeople([])
    } finally {
      setLoading(false)
    }
  }, [ready, user?.uid])

  useEffect(() => {
    load()
  }, [load])

  async function handleAddPerson(e) {
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
      await createPerson(user.uid, { name: n, mobile: m })
      setName('')
      setMobile('')
      await load()
    } catch (err) {
      if (err?.code === 'permission-denied') {
        setError(
          'Missing or insufficient permissions — your Firestore rules are not allowing this yet. In Firebase Console → Firestore → Rules, paste the contents of firestore.rules from this project and click Publish. Tip: run npm run deploy:firestore in a terminal here to print those rules.',
        )
      } else {
        setError(err?.message || 'Could not save this person.')
      }
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">People</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Add someone you give money to. Each person has their own page where you record how much you gave and when — with or without interest.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Add a new person</h2>
        <p className="mt-1 text-xs text-slate-500">Name and mobile are saved under “people” in your database.</p>
        <form onSubmit={handleAddPerson} className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="person-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="person-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
              placeholder="Full name"
              autoComplete="name"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="person-mobile" className="block text-sm font-medium text-slate-700">
              Mobile number
            </label>
            <input
              id="person-mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
              placeholder="10-digit mobile"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save person'}
          </button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800">Your people</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : people.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No one added yet. Use the form above to add the first person.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {people.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-600">{p.mobile}</p>
                </div>
                <Link
                  to={`/people/${p.id}`}
                  className="inline-flex shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100"
                >
                  Open their record
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default PeopleList
