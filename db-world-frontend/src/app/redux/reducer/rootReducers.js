import {combineReducers} from "redux";
import userReducer from "./userReducer";
import loginReducer from "./loginReducer";
import searchReducer from "./searchReducer";
import reloadMoviesReducer from "./reloadMoviesReducer";
import moviePageNumberReducer from "./moviePageNumberReducer";
import filterSelectionReducer from "./filerSelectionReducer";
import seriesPageNumberReducer from "./seriesPageNumberReducer";
import downloadProgressReducer from "./downloadProgressReducer";

const rootReducers = combineReducers ({
    loginReducer,
    userReducer,
    searchReducer,
    reloadMoviesReducer,
    filterSelectionReducer,
    moviePageNumberReducer,
    seriesPageNumberReducer,
    downloadProgressReducer,
});

export default rootReducers;