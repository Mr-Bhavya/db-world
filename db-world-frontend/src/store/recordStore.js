// src/store/recordStore.js
import { create } from 'zustand';

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
//      console.log('Updated record:', updatedRecords.records[updated.recordId]);
      return updatedRecords;
    }),

  addRecords: (newRecords) =>
    set((state) => {
      const merged = { ...state.records };
      newRecords.forEach((r) => {
        merged[r.recordId] = { ...merged[r.recordId], ...r };
      });
//      console.log('Added records:', Object.keys(merged).length);
//      console.log('Merged records:', merged);
      return { records: merged };
    }),
}));

export default useRecordStore;
