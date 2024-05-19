const initialPageNumber = {
    all:0,
    bollywood:0,
    hollywood:0,
    south:0,
    gujarati:0
}

const seriesPageNumberReducer = (state = initialPageNumber, action) => {
    var {all, bollywood, hollywood, south, gujarati} = state;
    switch (action.type){
        case "SERIESPAGENUMBER" : {
            all=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati};
            return state;
        }case "SERIESPAGENUMBER_B" : {
            bollywood=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati};
            return state;
        }
        case "SERIESPAGENUMBER_H" : {
            hollywood=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati};
            return state;
        }
        case "SERIESPAGENUMBER_S" : {
            south=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati};
            return state;
        }
        case "SERIESPAGENUMBER_G" : {
            gujarati=action.pageNumber
            state = {all,bollywood, hollywood, south, gujarati};
            return state;
        }
        default : {
            return state;
        }
    }
}

export default seriesPageNumberReducer;