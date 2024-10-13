import {combineReducers} from "redux";
import userReducer from "./userReducer";
import loginReducer from "./loginReducer";
import searchReducer from "./searchReducer";
import movieIDReducer from "./movieIDReducer";
import searchListReducer from "./searchListReducer";
import reloadMoviesReducer from "./reloadMoviesReducer";
import moviePageNumberReducer from "./moviePageNumberReducer";
import filterSelectionReducer from "./filerSelectionReducer";
import seriesPageNumberReducer from "./seriesPageNumberReducer";
import displayDbCinemaRecordsReducer from "./displayDbCinemaRecordsReducer";
import downloadProgressReducer from "./downloadProgressReducer";

const rootReducers = combineReducers ({
    loginReducer,
    userReducer,
    searchReducer,
    movieIDReducer,
    searchListReducer,
    reloadMoviesReducer,
    filterSelectionReducer,
    moviePageNumberReducer,
    seriesPageNumberReducer,
    downloadProgressReducer,
    displayDbCinemaRecordsReducer,
});

export default rootReducers;