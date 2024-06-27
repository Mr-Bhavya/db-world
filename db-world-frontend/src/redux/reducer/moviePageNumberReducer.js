const initialPageNumber = {
    all:0,
    bollywood:0,
    hollywood:0,
    south:0,
    gujarati:0,
    korean:0
}

const moviePageNumberReducer = (state = initialPageNumber, action) => {
    var {all, bollywood, hollywood, south, gujarati, korean} = state;
    switch (action.type){
        case "MOVIEPAGENUMBER" : {
            all=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }case "MOVIEPAGENUMBER_B" : {
            bollywood=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }
        case "MOVIEPAGENUMBER_H" : {
            hollywood=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }
        case "MOVIEPAGENUMBER_S" : {
            south=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }
        case "MOVIEPAGENUMBER_G" : {
            gujarati=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }
        case "MOVIEPAGENUMBER_K" : {
            korean=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati, korean};
            return state;
        }
        default : {
            return state;
        }
    }
}

export default moviePageNumberReducer;