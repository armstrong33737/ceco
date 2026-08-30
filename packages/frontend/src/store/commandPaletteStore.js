// packages/frontend/src/store/commandPaletteStore.js
import { create } from "zustand";

export const useCommandPaletteStore = create((set, get) => ({
  isOpen: false,
  searchQuery: "",

  open: () => set({ isOpen: true, searchQuery: "" }),
  close: () => set({ isOpen: false, searchQuery: "" }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, searchQuery: "" })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));