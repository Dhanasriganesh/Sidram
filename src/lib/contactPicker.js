/**
 * Pick a contact: native iOS/Android (Capacitor) or web Contact Picker API (Android Chrome).
 */
import { Capacitor } from '@capacitor/core'
import { isIOSDevice } from './device'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export function isWebContactPickerSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof navigator.contacts?.select === 'function'
  )
}

/** Show import button when any path might work. */
export function isContactImportAvailable() {
  if (isNativeApp()) return true
  if (isWebContactPickerSupported()) return true
  if (isIOSDevice()) return true
  return false
}

function firstNonEmptyString(values) {
  if (!Array.isArray(values)) return ''
  for (const v of values) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

function pickPhoneNumber(telValues) {
  if (!Array.isArray(telValues) || telValues.length === 0) return ''
  const candidates = telValues.map((t) => String(t ?? '').trim()).filter(Boolean)
  const withDigits = candidates.filter((t) => /\d/.test(t))
  const pool = withDigits.length > 0 ? withDigits : candidates
  return pool.sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0] ?? ''
}

function pickPhoneFromNativePhones(phones) {
  if (!Array.isArray(phones) || phones.length === 0) return ''
  const sorted = [...phones].sort((a, b) => {
    const score = (p) => {
      let s = 0
      if (p?.type === 'mobile') s += 4
      if (p?.isPrimary) s += 2
      s += String(p?.number ?? '').replace(/\D/g, '').length / 20
      return s
    }
    return score(b) - score(a)
  })
  return pickPhoneNumber(sorted.map((p) => p?.number))
}

function parseNativeContact(contact) {
  const name =
    contact?.name?.display?.trim() ||
    [contact?.name?.given, contact?.name?.family].filter(Boolean).join(' ').trim() ||
    ''
  const mobile = pickPhoneFromNativePhones(contact?.phones)
  if (!mobile) {
    const err = new Error(
      'The selected contact has no phone number. Choose another contact or type the mobile number.',
    )
    err.code = 'no-phone'
    throw err
  }
  return { name, mobile }
}

async function ensureNativeContactsPermission(Contacts) {
  const status = await Contacts.requestPermissions()
  if (status.contacts === 'granted' || status.contacts === 'limited') return
  const err = new Error('Contacts permission is required to import from your phone.')
  err.code = 'permission-denied'
  throw err
}

async function pickNativeContact() {
  const { Contacts } = await import('@capacitor-community/contacts')
  await ensureNativeContactsPermission(Contacts)

  try {
    const { contact } = await Contacts.pickContact({
      projection: { name: true, phones: true },
    })
    if (!contact) {
      const err = new Error('No contact was selected.')
      err.code = 'cancelled'
      throw err
    }
    return parseNativeContact(contact)
  } catch (err) {
    if (err?.code === 'no-phone' || err?.code === 'permission-denied') throw err
    if (err?.message?.toLowerCase?.().includes('cancel')) {
      const cancelled = new Error('No contact was selected.')
      cancelled.code = 'cancelled'
      throw cancelled
    }
    const fallback = new Error('Open contact list')
    fallback.code = 'use-contact-list'
    throw fallback
  }
}

/**
 * Load contacts for the in-app searchable list (native only).
 * @returns {Promise<Array<{ id: string, name: string, mobile: string }>>}
 */
export async function loadNativeContactsForPicker() {
  const { Contacts } = await import('@capacitor-community/contacts')
  await ensureNativeContactsPermission(Contacts)

  const { contacts } = await Contacts.getContacts({
    projection: { name: true, phones: true },
  })

  const rows = []
  for (const c of contacts ?? []) {
    const mobile = pickPhoneFromNativePhones(c?.phones)
    if (!mobile) continue
    const name =
      c?.name?.display?.trim() ||
      [c?.name?.given, c?.name?.family].filter(Boolean).join(' ').trim() ||
      mobile
    rows.push({
      id: c.contactId || `${name}-${mobile}`,
      name,
      mobile,
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return rows
}

async function pickWebContact() {
  if (!isWebContactPickerSupported()) {
    const err = new Error(iosSafariHelpMessage())
    err.code = 'unsupported'
    throw err
  }

  let properties = ['name', 'tel']
  if (typeof navigator.contacts.getProperties === 'function') {
    try {
      const available = await navigator.contacts.getProperties()
      properties = ['name', 'tel'].filter((p) => available.includes(p))
      if (!properties.includes('tel')) {
        const err = new Error('This browser cannot share phone numbers from contacts.')
        err.code = 'unsupported'
        throw err
      }
    } catch {
      // Use default properties if getProperties fails.
    }
  }

  const contacts = await navigator.contacts.select(properties, { multiple: false })
  const contact = contacts?.[0]
  if (!contact) {
    const err = new Error('No contact was selected.')
    err.code = 'cancelled'
    throw err
  }

  const name = firstNonEmptyString(contact.name)
  const mobile = pickPhoneNumber(contact.tel)

  if (!mobile) {
    const err = new Error(
      'The selected contact has no phone number. Choose another contact or type the mobile number.',
    )
    err.code = 'no-phone'
    throw err
  }

  return { name, mobile }
}

function iosSafariHelpMessage() {
  return (
    'On iPhone: use the Sidram app (build with npm run cap:ios on a Mac and install on your phone), ' +
    'or enable Settings → Safari → Advanced → Feature Flags → Contact Picker API. ' +
    'You can also type name and mobile below.'
  )
}

/**
 * @returns {Promise<{ name: string, mobile: string }>}
 */
export async function pickContactFromDevice() {
  if (isNativeApp()) {
    return pickNativeContact()
  }
  return pickWebContact()
}
