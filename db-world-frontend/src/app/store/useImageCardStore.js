import {create} from 'zustand';

const useImageCardStore = create((set, get) => ({
    recordsMap: {},

    getRecords: (key) => get().recordsMap[key]?.records || [],
    getPage: (key) => get().recordsMap[key]?.page || 0,
    getTotalPages: (key) => get().recordsMap[key]?.totalPages || 0,
    getActiveRecord: (key) => get().recordsMap[key]?.activeRecord || null,

    setRecords: (key, newRecords, page, totalPages) => {
        set(state => ({
            recordsMap: {
                ...state.recordsMap,
                [key]: {
                    ...(state.recordsMap[key] || {}),
                    records: page === 0 ? newRecords : [
                        ...new Map([
                            ...(state.recordsMap[key]?.records || []),
                            ...newRecords
                        ].map(r => [r.recordId, r])).values()
                    ],
                    page,
                    totalPages,
                },
            },
        }));
    },

    setActiveRecord: (key, record) => {
        set(state => ({
            recordsMap: {
                ...state.recordsMap,
                [key]: {
                    ...(state.recordsMap[key] || {}),
                    activeRecord: record,
                },
            },
        }));
    },

    // Inside Zustand action
    updateRecords: (key, newRecords, page, total) =>
        set((state) => {
            const prev = state.recordsMap[key]?.records || [];
            const merged = Array.from(
                new Map([...prev, ...newRecords].map(r => [r.recordId, r])).values()
            );

            // Shallow check: only update if different
            const isSame = prev.length === merged.length &&
                prev.every((r, i) => r.recordId === merged[i].recordId);

            if (isSame) return {};

            return {
                recordsMap: {
                    ...state.recordsMap,
                    [key]: {
                        records: merged,
                        page,
                        totalPages: total,
                    }
                }
            };
        }),

}));

export default useImageCardStore;
