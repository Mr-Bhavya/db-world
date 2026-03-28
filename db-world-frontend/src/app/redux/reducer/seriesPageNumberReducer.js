const initialPageNumber = {
    all: 0,
    bollywood: 0,
    hollywood: 0,
    south: 0,
    gujarati: 0,
    korean: 0,
    disPageNumber: 0,
    totalPages: 0
}

const seriesPageNumberReducer = (state = initialPageNumber, action) => {
    switch (action.type) {
        case "SERIESPAGENUMBER": {
            state.all = action.pageNumber
            return state;
        } case "SERIESPAGENUMBER_B": {
            state.bollywood = action.pageNumber
            return state;
        }
        case "SERIESPAGENUMBER_H": {
            state.hollywood = action.pageNumber
            return state;
        }
        case "SERIESPAGENUMBER_S": {
            state.south = action.pageNumber
            return state;
        }
        case "SERIESPAGENUMBER_G": {
            state.gujarati = action.pageNumber
            return state;
        }
        case "SERIESPAGENUMBER_K": {
            state.korean = action.pageNumber
            return state;
        }
        default: {
            return state;
        }
    }
}

export default seriesPageNumberReducer;