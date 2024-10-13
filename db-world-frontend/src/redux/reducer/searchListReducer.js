const searchListReducer = (state = { fileList: [], folderList: [] }, action) => {
    switch (action.type) {
        case "SEARCH_LIST": {
            state = action.searchList;
            return state;
        }
        default: {
            return state;
        }
    }
}

export default searchListReducer;