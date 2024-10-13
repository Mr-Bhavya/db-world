const loginReducer = (state = localStorage.getItem('login'), action) => {
    switch (action.type) {
        case "LOGIN": {
            console.log("Login is Successfull.")
            localStorage.setItem('login', true);
            state = true
            return state;
        }
        case "LOGOUT": {
            console.log("Logout is Successfull.")
            localStorage.setItem('login', false);
            localStorage.setItem('user',null);
            state = false
            return state;
        }
        default: {
            return state;
        }
    }
}

export default loginReducer;