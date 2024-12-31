const initialState = {
    catagory: "movie",
    movieIndustry: "all",
    seriesIndustry: 'all',
    genres: [],
    page: 0,
    totalPages: 0
}

const filterSelectionReducer = (state = initialState, action) => {
    switch (action.type) {
        case "FILTERSELECTION": {
            state = action.filter;
            return state;
        }
        default: {
            return state;
        }
    }
}

export default filterSelectionReducer;