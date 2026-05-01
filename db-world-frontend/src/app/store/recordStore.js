// src/store/recordStore.js
import {create} from 'zustand';

const useRecordStore = create((set) => ({
  records: {}, // { [recordId]: record }

  updateRecord: (updated) =>
    set((state) => {
      const current = state.records[updated.recordId] || {};
      const updatedRecords = {
        records: {
          ...state.records,
          [updated.recordId]: { ...current, ...updated },
        },
      };
      return updatedRecords;
    }),

  addRecords: (newRecords) =>
    set((state) => {
      const merged = { ...state.records };
      newRecords.forEach((r) => {
        merged[r.recordId] = { ...merged[r.recordId], ...r };
      });
      return { records: merged };
    }),
}));

export default useRecordStore;
