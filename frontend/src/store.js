import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({
      householdId: null,
      userId: null,
      householdName: '',
      userName: '',
      theme: 'dark', // 'light' or 'dark'
      colorTheme: 'default', // 'default', 'pink', etc.
      hideStatistics: false,
      setTheme: (theme) => set({ theme }),
      setColorTheme: (colorTheme) => set({ colorTheme }),
      setHideStatistics: (hideStatistics) => set({ hideStatistics }),
      setHousehold: (id, name) => set({ householdId: id, householdName: name }),
      setUser: (id, name) => set({ userId: id, userName: name }),
      logout: () => set({ householdId: null, userId: null, householdName: '', userName: '' }),
    }),
    {
      name: 'money-manager-storage',
    }
  )
);

export default useStore;
