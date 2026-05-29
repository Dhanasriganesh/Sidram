import React, { useEffect, useMemo, useState } from 'react'
import { loadNativeContactsForPicker } from '../lib/contactPicker'

/**
 * Searchable contact list fallback (native iOS/Android when system picker is unavailable).
 */
function ContactListModal({ onSelect, onClose, onError }) {
  const [contacts, setContacts] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await loadNativeContactsForPicker()
        if (!cancelled) setContacts(rows)
      } catch (err) {
        if (!cancelled) onError?.(err?.message || 'Could not load contacts.')
        onClose()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onClose, onError])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.mobile.replace(/\D/g, '').includes(q.replace(/\D/g, '')),
    )
  }, [contacts, query])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="contact-list-title">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <h2 id="contact-list-title" className="text-base font-semibold text-slate-900">
              Choose a contact
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or number"
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-teal-600/20 focus:border-teal-500 focus:ring-2"
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading contacts…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No contacts with a phone number found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ name: c.name, mobile: c.mobile })}
                    className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="text-sm text-slate-600">{c.mobile}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContactListModal
