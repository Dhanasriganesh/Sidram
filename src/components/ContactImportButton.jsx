import React, { useState } from 'react'
import ContactListModal from './ContactListModal'
import { isContactImportAvailable, isNativeApp, pickContactFromDevice } from '../lib/contactPicker'
import { isIOSDevice } from '../lib/device'

const variantClasses = {
  teal: 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 focus:ring-teal-600/30',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 focus:ring-amber-600/30',
}

/**
 * @param {{ variant?: 'teal' | 'amber', disabled?: boolean, onImport: (data: { name: string, mobile: string }) => void, onError?: (message: string) => void }} props
 */
function ContactImportButton({ variant = 'teal', disabled = false, onImport, onError }) {
  const [loading, setLoading] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const available = isContactImportAvailable()

  async function handleClick() {
    setLoading(true)
    try {
      const picked = await pickContactFromDevice()
      onImport(picked)
    } catch (err) {
      if (err?.code === 'cancelled') return
      if (err?.code === 'use-contact-list' && isNativeApp()) {
        setListOpen(true)
        return
      }
      onError?.(err?.message || 'Could not import from contacts.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled={disabled || loading || !available}
          onClick={handleClick}
          className={`inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant] ?? variantClasses.teal}`}
        >
          <ContactIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          {loading ? 'Opening contacts…' : 'Import from phone contacts'}
        </button>
        {isNativeApp() && (
          <p className="text-xs text-slate-500">Opens your phone&apos;s contact picker. Allow access when asked.</p>
        )}
        {!isNativeApp() && isIOSDevice() && !available && (
          <p className="text-xs text-slate-500">
            On iPhone in Safari, use the Sidram app or type details below. Android: use Chrome.
          </p>
        )}
        {!isNativeApp() && !isIOSDevice() && !available && (
          <p className="text-xs text-slate-500">
            Available in Chrome on Android (HTTPS). On other devices, type name and mobile below.
          </p>
        )}
      </div>
      {listOpen && (
        <ContactListModal
          onSelect={(picked) => {
            setListOpen(false)
            onImport(picked)
          }}
          onClose={() => setListOpen(false)}
          onError={onError}
        />
      )}
    </>
  )
}

function ContactIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}

export default ContactImportButton
