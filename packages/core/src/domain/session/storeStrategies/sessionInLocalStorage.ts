import { generateUUID } from '../../../tools/utils/stringUtils'
import type { Configuration } from '../../configuration'
import { SessionPersistence } from '../sessionConstants'
import type { SessionState } from '../sessionState'
import { toSessionString, toSessionState, getExpiredSessionState } from '../sessionState'
import type { SessionStoreStrategy, SessionStoreStrategyType } from './sessionStoreStrategy'
import { SESSION_STORE_KEY } from './sessionStoreStrategy'

const LOCAL_STORAGE_TEST_KEY = '_dd_test_'

export function selectLocalStorageStrategy(): SessionStoreStrategyType | undefined {
  try {
    const id = generateUUID()
    const testKey = `${LOCAL_STORAGE_TEST_KEY}${id}`
    localStorage.setItem(testKey, id)
    const retrievedId = localStorage.getItem(testKey)
    localStorage.removeItem(testKey)
    return id === retrievedId ? { type: SessionPersistence.LOCAL_STORAGE } : undefined
  } catch {
    return undefined
  }
}

export function initLocalStorageStrategy(configuration: Configuration): SessionStoreStrategy {
  return {
    isLockEnabled: false,
    persistSession: persistInLocalStorage,
    retrieveSession: retrieveSessionFromLocalStorage,
    expireSession: (sessionState: SessionState) => expireSessionFromLocalStorage(sessionState, configuration),
  }
}

function persistInLocalStorage(sessionState: SessionState) {
  localStorage.setItem(SESSION_STORE_KEY, toSessionString(sessionState))
}

function retrieveSessionFromLocalStorage(): SessionState {
  const sessionString = localStorage.getItem(SESSION_STORE_KEY)
  return toSessionState(sessionString)
}

function expireSessionFromLocalStorage(previousSessionState: SessionState, configuration: Configuration) {
  persistInLocalStorage(getExpiredSessionState(previousSessionState, configuration))
}
