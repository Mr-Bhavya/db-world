const reloadMoviesReducer = (state = false, action) => {
    switch (action.type) {
        case "RELOADMOVIES": {
            state = !state;
            return state;
        }
        default: {
            return state;
        }
    }
}

export default reloadMoviesReducer;