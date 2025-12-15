import { create } from 'zustand'

interface WalletState {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null

  setAddress: (address: string | null) => void
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,

  setAddress: (address) =>
    set({
      address,
      isConnected: !!address,
      isConnecting: false,
      error: null,
    }),

  setConnecting: (connecting) =>
    set({ isConnecting: connecting, error: null }),

  setError: (error) =>
    set({ error, isConnecting: false }),

  disconnect: () =>
    set({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    }),
}))
