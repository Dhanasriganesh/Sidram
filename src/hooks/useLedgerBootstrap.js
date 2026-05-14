import { useEffect, useRef } from 'react'
import { useAuth } from '../context/useAuth'
import { db, isFirebaseConfigured } from '../firebase/config'
import { ensurePeopleCollectionExists } from '../services/ledgerBootstrap'

/**
 * After login, ensures the `people` collection exists (one hidden doc per user).
 */
export function useLedgerBootstrap() {
  const { user } = useAuth()
  const lastBootstrappedUid = useRef(null)

  useEffect(() => {
    if (!user?.uid) {
      lastBootstrappedUid.current = null
      return
    }
    if (!isFirebaseConfigured() || !db) return
    if (lastBootstrappedUid.current === user.uid) return

    lastBootstrappedUid.current = user.uid
    ensurePeopleCollectionExists(user.uid).catch(() => {})
  }, [user?.uid])
}
