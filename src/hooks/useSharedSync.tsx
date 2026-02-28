import {
	SyncContextProvider as RoboSyncContextProvider,
	useSyncState as useRoboSyncState,
} from '@robojs/sync/client'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Updater<T> = T | ((prev: T) => T)
type Listener = () => void

const localState = new Map<string, unknown>()
const listeners = new Map<string, Set<Listener>>()

// Cloudflare Pages serves a static frontend and a token function, but no /sync websocket.
// Fall back to per-tab shared state in production so Discord embed mode avoids websocket failures.
const useLocalSync = !import.meta.env.DEV

function keyToString(key: string[]) {
	return key.join('.')
}

function emit(key: string) {
	const keyListeners = listeners.get(key)
	if (!keyListeners) return
	for (const listener of keyListeners) {
		listener()
	}
}

function subscribe(key: string, listener: Listener) {
	const keyListeners = listeners.get(key) ?? new Set<Listener>()
	keyListeners.add(listener)
	listeners.set(key, keyListeners)
	return () => {
		keyListeners.delete(listener)
		if (keyListeners.size === 0) {
			listeners.delete(key)
		}
	}
}

export function SyncContextProvider(props: { children: ReactNode; loadingScreen?: ReactNode }) {
	if (useLocalSync) {
		return <>{props.children}</>
	}
	return <RoboSyncContextProvider {...props} />
}

export function useSyncState<T>(initialState: T, key: string[]): [T, (value: Updater<T>) => void] {
	if (!useLocalSync) {
		return useRoboSyncState<T>(initialState, key)
	}

	const storageKey = keyToString(key)
	if (!localState.has(storageKey)) {
		localState.set(storageKey, initialState)
	}

	const [state, setState] = useState<T>(() => localState.get(storageKey) as T)

	useEffect(() => subscribe(storageKey, () => setState(localState.get(storageKey) as T)), [storageKey])

	const setLocalState = (value: Updater<T>) => {
		const current = (localState.get(storageKey) as T) ?? initialState
		const next = typeof value === 'function' ? (value as (prev: T) => T)(current) : value
		localState.set(storageKey, next)
		emit(storageKey)
	}

	return [state, setLocalState]
}
