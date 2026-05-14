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
import { computeEntryTotalDue } from '../lib/loanMath'
import { normalizeMobileKey } from '../lib/phone'

export function borrowedFromCollectionRef() {
  return collection(db, 'borrowedFrom')
}

export function borrowedEntriesCollectionRef(lenderId) {
  return collection(db, 'borrowedFrom', lenderId, 'entries')
}

/**
 * @param {string} ownerUid
 */
export async function listBorrowedFrom(ownerUid) {
  const q = query(borrowedFromCollectionRef(), where('ownerUid', '==', ownerUid))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      name: data.name ?? '',
      mobile: data.mobile ?? '',
      createdAt: data.createdAt ?? null,
    }
  })
  rows.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0
    const tb = b.createdAt?.toMillis?.() ?? 0
    return tb - ta
  })
  return rows
}

/**
 * @param {string} lenderId
 * @param {string} ownerUid
 */
export async function getBorrowedLenderIfOwner(lenderId, ownerUid) {
  const ref = doc(db, 'borrowedFrom', lenderId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.ownerUid !== ownerUid) return null
  return {
    id: snap.id,
    name: data.name ?? '',
    mobile: data.mobile ?? '',
    createdAt: data.createdAt ?? null,
  }
}

export async function hasDuplicateBorrowedMobileForOwner(ownerUid, mobile) {
  const key = normalizeMobileKey(mobile)
  if (!key) return false
  const list = await listBorrowedFrom(ownerUid)
  return list.some((p) => normalizeMobileKey(p.mobile) === key)
}

export async function createBorrowedLender(ownerUid, input) {
  const duplicate = await hasDuplicateBorrowedMobileForOwner(ownerUid, input.mobile)
  if (duplicate) {
    const err = new Error('This mobile number is already used for someone you owe.')
    err.code = 'duplicate-mobile'
    throw err
  }
  await addDoc(borrowedFromCollectionRef(), {
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    ownerUid,
    createdAt: serverTimestamp(),
  })
}

export async function deleteBorrowedLenderAndEntries(lenderId, ownerUid) {
  const lender = await getBorrowedLenderIfOwner(lenderId, ownerUid)
  if (!lender) {
    const err = new Error('Record not found or access denied.')
    err.code = 'not-found'
    throw err
  }

  const entriesSnap = await getDocs(query(borrowedEntriesCollectionRef(lenderId)))
  const entryRefs = entriesSnap.docs.map((d) => d.ref)

  for (let i = 0; i < entryRefs.length; i += 500) {
    const slice = entryRefs.slice(i, i + 500)
    if (slice.length === 0) continue
    const batch = writeBatch(db)
    slice.forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  await deleteDoc(doc(db, 'borrowedFrom', lenderId))
}

export async function listBorrowedEntries(lenderId) {
  const q = query(borrowedEntriesCollectionRef(lenderId), orderBy('givenAt', 'desc'))
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

export async function createBorrowedEntry(lenderId, input) {
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
  await addDoc(borrowedEntriesCollectionRef(lenderId), payload)
}

export async function recordBorrowedRepayment(lenderId, entryId, payment) {
  const amount = Number(payment.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Enter a valid repayment amount greater than zero.')
    err.code = 'invalid-amount'
    throw err
  }

  const paidAt = payment.paidAt instanceof Date ? payment.paidAt : new Date(payment.paidAt)
  if (Number.isNaN(paidAt.getTime())) {
    const err = new Error('Invalid date.')
    err.code = 'invalid-date'
    throw err
  }

  const ref = doc(db, 'borrowedFrom', lenderId, 'entries', entryId)

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
      const err = new Error('This entry is already fully repaid.')
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
 * Sum of remaining balance (what Siddu still owes) across all lenders and their entries.
 */
export async function getTotalBorrowedOutstanding(ownerUid) {
  const lenders = await listBorrowedFrom(ownerUid)
  let total = 0
  for (const l of lenders) {
    const entries = await listBorrowedEntries(l.id)
    for (const e of entries) {
      total += Math.max(0, Number(e.balance) || 0)
    }
  }
  return total
}
