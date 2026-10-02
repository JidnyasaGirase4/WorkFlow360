import { useSyncExternalStore } from 'react'

// Tiny external store so mock "server" state (tasks, tickets, invoices...)
// survives navigation between portal pages without a backend.
export function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
