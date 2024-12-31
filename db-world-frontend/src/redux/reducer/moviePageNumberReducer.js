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

const moviePageNumberReducer = (state = initialPageNumber, action) => {
    switch (action.type) {
        case "MOVIEPAGENUMBER_A": {
            state.all = action.pageNumber
            return state;
        } case "MOVIEPAGENUMBER_B": {
            state.bollywood = action.initialPageNumber
            return state;
        }
        case "MOVIEPAGENUMBER_H": {
            state.hollywood = action.pageNumber
            return state;
        }
        case "MOVIEPAGENUMBER_S": {
            state.south = action.pageNumber
            return state;
        }
        case "MOVIEPAGENUMBER_G": {
            state.gujarati = action.pageNumber
            return state;
        }
        case "MOVIEPAGENUMBER_K": {
            state.korean = action.pageNumber
            return state;
        }
        default: {
            return state;
        }
    }
}

export default moviePageNumberReducer;