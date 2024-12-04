const initialState = {
    catagory: "movie",
    movieIndustry: "all",
    seriesIndustry: 'all',
    genres: []
}

const filterSelectionReducer = (state = initialState, action) => {
    switch (action.type) {
        case "FILTERSELECTION": {
            const { catagory, movieIndustry, seriesIndustry, genres } = action.filter;
            state = {
                catagory, movieIndustry, seriesIndustry, genres
            }
            return state;
        }
        default: {
            return state;
        }
    }
}

export default filterSelectionReducer;