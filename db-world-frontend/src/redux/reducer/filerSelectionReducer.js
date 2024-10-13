const initialState = {
    catagory:"movie",
    movieIndustry:"all",
    seriesIndustry:'all'
}

const filterSelectionReducer = (state=initialState,action) => {
    switch (action.type) {
        case "FILTERSELECTION" : {
            const {catagory, movieIndustry, seriesIndustry} = action.filter;
            state = {
                catagory, movieIndustry, seriesIndustry
            }
            return state;
        }
        default : {
            return state;
        }
    }
}

export default filterSelectionReducer;