const startingState = localStorage.getItem('user') == null
    ? null : JSON.parse(localStorage.getItem('user'));


const userReducer = (state = startingState, action) => {
    switch (action.type) {
        case "ADD_USER": {
            state = action.user;
            return state;
        }
        case "REMOVE_USER": {
            state = null;
            return state;
        }
        case "FINDALLUSERS": {
            return action;
        }
        default: {
            return state;
        }
    }
}

export default userReducer;