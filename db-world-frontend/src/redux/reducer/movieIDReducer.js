const movieIDReducer = (state="1c_AOe6S7AuP3Pp0qYncgw83nkjPEXqi7",action) => {
    switch (action.type){
        case "UPDATEMOVIEID" : {
            state = action.id;
            return 34;
        }
        default : {
            return state;
        }
    }
}

export default movieIDReducer;