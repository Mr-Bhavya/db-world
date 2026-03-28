const startingState = localStorage.getItem('downloadFileStatus') == null
    ? null : JSON.parse(localStorage.getItem('downloadFileStatus'));


const downloadProgressReducer = (state = startingState, action) => {
    switch (action.type) {
        case "UPDATE_DOWNLOAD_PROGRESS": {
            state = action.downloadFileStatus;
            localStorage.setItem('downloadFileStatus', JSON.stringify(state));
            return state;
        }
        case "GET_DOWNLOAD_PROGRESS": {
            state = JSON.parse(localStorage.getItem("downloadFileStatus"));
            return state;
        }
        default: {
            return state;
        }
    }
}

export default downloadProgressReducer;