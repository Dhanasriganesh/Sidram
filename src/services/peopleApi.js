import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'
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
 * @param {string} ownerUid
 * @param {{ name: string, mobile: string }} input
 */
export async function createPerson(ownerUid, input) {
  await addDoc(peopleCollectionRef(), {
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    ownerUid,
    createdAt: serverTimestamp(),
  })
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
 * @param {string} personId
 * @returns {Promise<Array<{ id: string, amount: number, givenAt: import('@firebase/firestore').Timestamp, withInterest: boolean, interestPercent: number | null, interestAmount: number | null, createdAt: import('@firebase/firestore').Timestamp | null }>>}
 */
export async function listEntries(personId) {
  const q = query(entriesCollectionRef(personId), orderBy('givenAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
      givenAt: data.givenAt,
      withInterest: !!data.withInterest,
      interestPercent:
        data.interestPercent === null || data.interestPercent === undefined
          ? null
          : Number(data.interestPercent),
      interestAmount:
        data.interestAmount === null || data.interestAmount === undefined
          ? null
          : Number(data.interestAmount),
      createdAt: data.createdAt ?? null,
    }
  })
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
  const payload = {
    amount: input.amount,
    givenAt: Timestamp.fromDate(input.givenAt),
    withInterest: input.withInterest,
    interestPercent: input.withInterest ? input.interestPercent : null,
    interestAmount: input.withInterest ? input.interestAmount : null,
    createdAt: serverTimestamp(),
  }
  await addDoc(entriesCollectionRef(personId), payload)
}
