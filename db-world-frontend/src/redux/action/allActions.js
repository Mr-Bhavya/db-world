export const userLogin = () => {
    return{
        type:"LOGIN"
    }
}

export const userLogout = () => {
    return{
        type:"LOGOUT"
    }
}

export const addUser = (user) => {
    return{
        type:"ADD_USER",
        user:user
    }
}

export const searchQuery = (query) => {
    return{
        type:"SEARCH",
        query:query
    }
}

export const searchInDriveQuery = (query) => {
    return{
        type:"SEARCH_IN_DRIVE",
        searchInDriveQuery:query
    }
}

export const searchList = (list) => {
    return{
        type:"SEARCH_LIST",
        searchList:list
    }
}

export const updateMovieID = (id) => {
    return{
        type:"UPDATEMOVIEID",
        id:id
    }
}

export const reloadMovies = () => {
    return{
        type:"RELOADMOVIES"
    }
}

export const moviePageNumber = (pageNumber) => {
    return{
        type:"MOVIEPAGENUMBER",
        pageNumber
    }
}

export const moviePageNumber_b = (pageNumber) => {
    return{
        type:"MOVIEPAGENUMBER_B",
        pageNumber
    }
}

export const moviePageNumber_h = (pageNumber) => {
    return{
        type:"MOVIEPAGENUMBER_H",
        pageNumber
    }
}

export const moviePageNumber_s = (pageNumber) => {
    return{
        type:"MOVIEPAGENUMBER_S",
        pageNumber
    }
}

export const moviePageNumber_g = (pageNumber) => {
    return{
        type:"MOVIEPAGENUMBER_G",
        pageNumber
    }
}

export const seriesPageNumber = (pageNumber) => {
    return{
        type:"SERIESPAGENUMBER",
        pageNumber
    }
}

export const seriesPageNumber_b = (pageNumber) => {
    return{
        type:"SERIESPAGENUMBER_B",
        pageNumber
    }
}

export const seriesPageNumber_h = (pageNumber) => {
    return{
        type:"SERIESPAGENUMBER_H",
        pageNumber
    }
}

export const seriesPageNumber_s = (pageNumber) => {
    return{
        type:"SERIESPAGENUMBER_S",
        pageNumber
    }
}

export const seriesPageNumber_g = (pageNumber) => {
    return{
        type:"SERIESPAGENUMBER_G",
        pageNumber
    }
}

export const filterSelection = (filter) => {
    return{
        type:"FILTERSELECTION",
        filter
    }
}

export const displayDbCinemaRecordsList = (dbCinemaRecords) => {
    return {
        type:"DISPLAYDBCINEMARECORDSLIST",
        dbCinemaRecords
    }
}

export const findAllUsers = (users) => {
    return{
        type:"FINDALLUSERS",
        users
    }
}