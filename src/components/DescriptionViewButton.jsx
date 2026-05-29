import React, { useState } from 'react'

/**
 * @param {{ description?: string | null, variant?: 'teal' | 'amber' }} props
 */
function DescriptionViewButton({ description, variant = 'teal' }) {
  const [open, setOpen] = useState(false)
  const text = String(description ?? '').trim()
  const hasText = text.length > 0

  const btnClass =
    variant === 'amber'
      ? 'border-amber-200 text-amber-900 hover:bg-amber-50'
      : 'border-teal-200 text-teal-800 hover:bg-teal-50'

  return (
    <>
      <button
        type="button"
        disabled={!hasText}
        onClick={() => setOpen(true)}
        className={`ml-1.5 inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent ${btnClass}`}
        title={hasText ? 'View description' : 'No description'}
      >
        View desc
      </button>
      {open && hasText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="desc-dialog-title"
            className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="desc-dialog-title" className="text-sm font-semibold text-slate-900">
              Description
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{text}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default DescriptionViewButton
