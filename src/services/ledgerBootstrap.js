import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/** Written on hidden bootstrap docs so we can filter them out of the People list. */
export const LEDGER_BOOTSTRAP_FLAG = '_sidramMeta'

export function ledgerBootstrapDocId(ownerUid) {
  return `_ledger_${ownerUid}`
}

/**
 * Ensures the top-level `people` collection exists in Firestore by writing one
 * hidden document (per signed-in user). Firestore has no empty collections;
 * this is the standard way to "create" a collection from the client.
 */
export async function ensurePeopleCollectionExists(ownerUid) {
  if (!db || !ownerUid) return

  const ref = doc(db, 'people', ledgerBootstrapDocId(ownerUid))
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    name: '—',
    mobile: '—',
    ownerUid,
    createdAt: serverTimestamp(),
    [LEDGER_BOOTSTRAP_FLAG]: true,
  })
}
