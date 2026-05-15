import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { normalizeMobileKey } from '../lib/phone'
import { computeEntryTotalDue } from '../lib/loanMath'
import { LEDGER_BOOTSTRAP_FLAG } from './ledgerBootstrap'

export function peopleCollectionRef() {
  return collection(db, 'people')
}

export function entriesCollectionRef(personId) {
  return collection(db, 'people', personId, 'entries')
}

/**
 * @param {string} ownerUid
 * @returns {Promise<Array<{ id: string, name: string, mobile: string, createdAt: import('@firebase/firestore').Timestamp | null }>>}
 */
export async function listPeople(ownerUid) {
  const q = query(peopleCollectionRef(), where('ownerUid', '==', ownerUid))
  const snap = await getDocs(q)
  const rows = snap.docs
    .map((d) => {
      const data = d.data()
      if (data[LEDGER_BOOTSTRAP_FLAG] === true) return null
      return {
        id: d.id,
        name: data.name ?? '',
        mobile: data.mobile ?? '',
        createdAt: data.createdAt ?? null,
      }
    })
    .filter(Boolean)
  rows.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  return rows
}

/**
 * @param {string} personId
 * @param {string} ownerUid
 */
export async function getPersonIfOwner(personId, ownerUid) {
  const ref = doc(db, 'people', personId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.ownerUid !== ownerUid) return null
  if (data[LEDGER_BOOTSTRAP_FLAG] === true) return null
  return {
    id: snap.id,
    name: data.name ?? '',
    mobile: data.mobile ?? '',
    createdAt: data.createdAt ?? null,
  }
}

/**
 * @param {string} ownerUid
 * @param {string} mobile
 */
export async function hasDuplicateMobileForOwner(ownerUid, mobile) {
  const key = normalizeMobileKey(mobile)
  if (!key) return false
  const people = await listPeople(ownerUid)
  return people.some((p) => normalizeMobileKey(p.mobile) === key)
}

/**
 * @param {string} ownerUid
 * @param {{ name: string, mobile: string }} input
 */
export async function createPerson(ownerUid, input) {
  const duplicate = await hasDuplicateMobileForOwner(ownerUid, input.mobile)
  if (duplicate) {
    const err = new Error('A person with this mobile number already exists.')
    err.code = 'duplicate-mobile'
    throw err
  }
  await addDoc(peopleCollectionRef(), {
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    ownerUid,
    createdAt: serverTimestamp(),
  })
}

/**
 * Deletes all money entries for this person, then the person document.
 * @param {string} personId
 * @param {string} ownerUid
 */
export async function deletePersonAndEntries(personId, ownerUid) {
  const person = await getPersonIfOwner(personId, ownerUid)
  if (!person) {
    const err = new Error('Person not found or access denied.')
    err.code = 'not-found'
    throw err
  }

  const entriesSnap = await getDocs(query(entriesCollectionRef(personId)))
  const entryRefs = entriesSnap.docs.map((d) => d.ref)

  for (let i = 0; i < entryRefs.length; i += 500) {
    const slice = entryRefs.slice(i, i + 500)
    if (slice.length === 0) continue
    const batch = writeBatch(db)
    slice.forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  await deleteDoc(doc(db, 'people', personId))
}

/**
 * @param {string} personId
 * @returns {Promise<Array<{ id: string, amount: number, givenAt: import('@firebase/firestore').Timestamp, withInterest: boolean, interestPercent: number | null, interestAmount: number | null, totalPaid: number, balance: number, lastPaymentAt: import('@firebase/firestore').Timestamp | null, createdAt: import('@firebase/firestore').Timestamp | null }>>}
 */
export async function listEntries(personId) {
  const q = query(entriesCollectionRef(personId), orderBy('givenAt', 'desc'))
  const snap = await getDocs(q)
  const rows = []
  let batch = writeBatch(db)
  let batchOps = 0

  for (const d of snap.docs) {
    const data = d.data()
    const amount = typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0
    const withInterest = !!data.withInterest
    const interestPercent =
      data.interestPercent === null || data.interestPercent === undefined
        ? null
        : Number(data.interestPercent)
    const interestAmount =
      data.interestAmount === null || data.interestAmount === undefined
        ? null
        : Number(data.interestAmount)
    const totalPaid = typeof data.totalPaid === 'number' ? data.totalPaid : Number(data.totalPaid) || 0

    const entryShape = { amount, withInterest, interestAmount }
    const totalDue = computeEntryTotalDue(entryShape)
    const computedBalance = Math.max(0, totalDue - totalPaid)

    let balance =
      data.balance !== undefined && data.balance !== null ? Number(data.balance) : Number.NaN
    const missingStoredBalance = !Number.isFinite(balance)
    if (missingStoredBalance) {
      balance = computedBalance
      batch.update(d.ref, { balance: computedBalance })
      batchOps++
      if (batchOps >= 450) {
        await batch.commit()
        batch = writeBatch(db)
        batchOps = 0
      }
    }

    rows.push({
      id: d.id,
      amount,
      givenAt: data.givenAt,
      withInterest,
      interestPercent,
      interestAmount,
      totalPaid,
      balance,
      lastPaymentAt: data.lastPaymentAt ?? null,
      createdAt: data.createdAt ?? null,
    })
  }

  if (batchOps > 0) {
    await batch.commit()
  }

  return rows
}

/**
 * @param {string} personId
 * @param {{
 *   amount: number,
 *   givenAt: Date,
 *   withInterest: boolean,
 *   interestPercent: number | null,
 *   interestAmount: number | null,
 * }} input
 */
export async function createEntry(personId, input) {
  const totalDue = computeEntryTotalDue({
    amount: input.amount,
    withInterest: input.withInterest,
    interestAmount: input.withInterest ? input.interestAmount : null,
  })
  const payload = {
    amount: input.amount,
    givenAt: Timestamp.fromDate(input.givenAt),
    withInterest: input.withInterest,
    interestPercent: input.withInterest ? input.interestPercent : null,
    interestAmount: input.withInterest ? input.interestAmount : null,
    totalPaid: 0,
    balance: totalDue,
    createdAt: serverTimestamp(),
  }
  await addDoc(entriesCollectionRef(personId), payload)
}

/**
 * Record a repayment against one money-given entry (updates totalPaid, balance, lastPaymentAt).
 * @param {string} personId
 * @param {string} entryId
 * @param {{ amount: number, paidAt: Date }} payment
 */
export async function recordEntryPayment(personId, entryId, payment) {
  const amount = Number(payment.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Enter a valid payment amount greater than zero.')
    err.code = 'invalid-amount'
    throw err
  }

  const paidAt = payment.paidAt instanceof Date ? payment.paidAt : new Date(payment.paidAt)
  if (Number.isNaN(paidAt.getTime())) {
    const err = new Error('Invalid payment date.')
    err.code = 'invalid-date'
    throw err
  }

  const ref = doc(db, 'people', personId, 'entries', entryId)

  await runTransaction(db, async (t) => {
    const snap = await t.get(ref)
    if (!snap.exists()) {
      const err = new Error('This entry was not found.')
      err.code = 'not-found'
      throw err
    }
    const data = snap.data()
    const entry = {
      amount: data.amount,
      withInterest: data.withInterest,
      interestAmount: data.interestAmount,
    }
    const totalDue = computeEntryTotalDue(entry)
    const paidSoFar = typeof data.totalPaid === 'number' ? data.totalPaid : Number(data.totalPaid) || 0
    const balance = totalDue - paidSoFar
    if (balance <= 0) {
      const err = new Error('This entry is already fully paid.')
      err.code = 'already-settled'
      throw err
    }
    if (amount > balance + 1e-6) {
      const err = new Error(
        `Maximum you can record here is ${balance.toFixed(2)} (remaining balance for this row).`,
      )
      err.code = 'overpay'
      throw err
    }
    const newPaid = paidSoFar + amount
    const newBalance = Math.max(0, totalDue - newPaid)
    t.update(ref, {
      totalPaid: newPaid,
      balance: newBalance,
      lastPaymentAt: Timestamp.fromDate(paidAt),
    })
  })
}

/**
 * Sum of remaining balance (what others still owe Siddu) across all people and their entries.
 */
export async function getTotalReceivableOutstanding(ownerUid) {
  const people = await listPeople(ownerUid)
  let total = 0
  for (const p of people) {
    const entries = await listEntries(p.id)
    for (const e of entries) {
      total += Math.max(0, Number(e.balance) || 0)
    }
  }
  return total
}
