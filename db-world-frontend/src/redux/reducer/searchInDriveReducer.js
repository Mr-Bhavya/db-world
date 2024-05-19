const searchInDriveReducer = (state="",action) => {
    switch (action.type){
        case "SEARCH_IN_DRIVE" : {
            state = action.searchInDriveQuery;
            return state;
        }
        default : {
            return state;
        }
    }
}

export default searchInDriveReducer;