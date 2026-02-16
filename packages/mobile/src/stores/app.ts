import { create } from 'zustand';

interface AppState {
  /** Currently selected account ID for filtering (null = all accounts). */
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;

  /** Transaction search query. */
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  /** Transaction category filter. */
  filterCategoryId: string | null;
  setFilterCategoryId: (id: string | null) => void;

  /** Clear all filters. */
  clearFilters: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  filterCategoryId: null,
  setFilterCategoryId: (id) => set({ filterCategoryId: id }),

  clearFilters: () =>
    set({
      selectedAccountId: null,
      searchQuery: '',
      filterCategoryId: null,
    }),
}));
