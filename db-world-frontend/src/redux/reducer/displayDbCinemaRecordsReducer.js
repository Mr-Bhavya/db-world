const initialState = {
    "records": null, "pageCount": null
}
const displayDbCinemaRecordsReducer = (state = initialState, action) => {
    switch (action.type) {
        case "DISPLAYDBCINEMARECORDSLIST": {
            console.log(action.dbCinemaRecords)
            state = action.dbCinemaRecords;
            return state;
        }
        default: {
            return state;
        }
    }
}

export default displayDbCinemaRecordsReducer;