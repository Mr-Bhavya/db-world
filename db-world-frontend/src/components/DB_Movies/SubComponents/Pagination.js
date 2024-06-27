import React from 'react';
import { moviePageNumber, moviePageNumber_b, moviePageNumber_g, moviePageNumber_h, moviePageNumber_k, moviePageNumber_s, seriesPageNumber, seriesPageNumber_b, seriesPageNumber_g, seriesPageNumber_h, seriesPageNumber_k, seriesPageNumber_s } from '../../../redux/action/allActions';
import { useDispatch } from 'react-redux';

function Pagination(props) {

    const { filter } = props;
    var { totalPage, disPageNumber } = props.page;
    var totalPageArray = [];
    for (let i = 1; i <= totalPage; i++) {
        totalPageArray.push(i);
    }
    // var moviePageNumberList = useSelector(state => state.moviePageNumberReducer)
    // const seriesPageNumberList = useSelector(state => state.seriesPageNumberReducer)
    const dispatch = useDispatch();


    async function pageUpdate(n) {

        if (filter.catagory === "movie") {
            if (filter.movieIndustry === "all") {
                // moviePageNumberList.all = n;
                dispatch(moviePageNumber(n))
            }
            else if (filter.movieIndustry === "bollywood") {
                // moviePageNumberList.bollywood = n;
                dispatch(moviePageNumber_b(n))
            }
            else if (filter.movieIndustry === "hollywood") {
                // moviePageNumberList.hollywood = n;
                dispatch(moviePageNumber_h(n))
            }
            else if (filter.movieIndustry === "south") {
                // moviePageNumberList.south = n;
                dispatch(moviePageNumber_s(n))
            }
            else if (filter.movieIndustry === "gujarati") {
                // moviePageNumberList.gujarati = n;
                dispatch(moviePageNumber_g(n))
            }
            else if (filter.movieIndustry === "korean") {
                // moviePageNumberList.korean = n;
                dispatch(moviePageNumber_k(n))
            }
            // navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${n + 1}`)
        }
        else if (filter.catagory === "series") {
            if (filter.seriesIndustry === "all") {
                dispatch(seriesPageNumber(n))
            }
            else if (filter.seriesIndustry === "bollywood") {
                dispatch(seriesPageNumber_b(n))
            }
            else if (filter.seriesIndustry === "hollywood") {
                dispatch(seriesPageNumber_h(n))
            }
            else if (filter.seriesIndustry === "south") {
                dispatch(seriesPageNumber_s(n))
            }
            else if (filter.seriesIndustry === "gujarati") {
                dispatch(seriesPageNumber_g(n))
            }
            else if (filter.seriesIndustry === "korean") {
                dispatch(seriesPageNumber_k(n))
            }
            // navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${n + 1}`)
        }

        // const data = await loadDbCinemaRecords(filter, moviePageNumberList);
        // dispatch(displayDbCinemaRecordsList(data.result))

    }

    // const updateUrl = () => {
    //     if (filter.catagory === "series") {
    //         switch (filter.seriesIndustry) {
    //             case "all":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${seriesPageNumberList.all + 1}`)
    //                 break;
    //             case "bollywood":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${seriesPageNumberList.bollywood + 1}`)
    //                 break;
    //             case "hollywood":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${seriesPageNumberList.hollywood + 1}`)
    //                 break;
    //             case "south":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${seriesPageNumberList.south + 1}`)
    //                 break;
    //             case "gujarati":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=series&seriesIndustry=${filter.seriesIndustry}&page=${seriesPageNumberList.gujarati + 1}`)
    //                 break;
    //         }
    //     }
    //     else {
    //         switch (filter.movieIndustry) {
    //             case "all":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${moviePageNumberList.all + 1}`)
    //                 break;
    //             case "bollywood":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${moviePageNumberList.bollywood + 1}`)
    //                 break;
    //             case "hollywood":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${moviePageNumberList.hollywood + 1}`)
    //                 break;
    //             case "south":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${moviePageNumberList.south + 1}`)
    //                 break;
    //             case "gujarati":
    //                 navigate(`${Constants.DB_MOVIES_ROUTE}?catagory=movie&movieIndustry=${filter.movieIndustry}&page=${moviePageNumberList.gujarati + 1}`)
    //                 break;
    //         }
    //     }
    // }

    // updateUrl();

    // const loadRecords = async () => {
    //     const data = await loadDbCinemaRecords(filter, moviePageNumberList);
    //     dispatch(displayDbCinemaRecordsList(data.result))
    // }



    // useEffect(() => {

    //     const parsedQuery = queryString.parse(location.search);
    //     console.log(parsedQuery)
    //     if (parsedQuery.movieIndustry) {
    //         if (parsedQuery.movieIndustry === "all") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "movie",
    //                 movieIndustry: "all"
    //             }))
    //             dispatch(moviePageNumber(parsedQuery.page - 1))
    //             moviePageNumberList.all = parsedQuery.page - 1
    //         }
    //         else if (parsedQuery.movieIndustry === "bollywood") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "movie",
    //                 movieIndustry: "bollywood"
    //             }))
    //             dispatch(moviePageNumber_b(parsedQuery.page - 1))
    //             moviePageNumberList.bollywood = parsedQuery.page - 1
    //         }
    //         else if (parsedQuery.movieIndustry === "hollywood") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "movie",
    //                 movieIndustry: "hollywood"
    //             }))
    //             dispatch(moviePageNumber_h(parsedQuery.page - 1))
    //             moviePageNumberList.hollywood = parsedQuery.page - 1
    //         }
    //         else if (parsedQuery.movieIndustry === "south") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "movie",
    //                 movieIndustry: "south"
    //             }))
    //             dispatch(moviePageNumber_s(parsedQuery.page - 1))
    //             moviePageNumberList.south = parsedQuery.page - 1
    //         }
    //         else if (parsedQuery.movieIndustry === "gujarati") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "movie",
    //                 movieIndustry: "gujarati"
    //             }))
    //             dispatch(moviePageNumber_g(parsedQuery.page - 1))
    //             moviePageNumberList.gujarati = parsedQuery.page - 1
    //         }
    //     } else if (parsedQuery.seriesIndustry) {
    //         if (parsedQuery.seriesIndustry === "all") {
    //             dispatch(seriesPageNumber(parsedQuery.page - 1))
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "series",
    //                 seriesIndustry: "all"
    //             }))

    //         }
    //         else if (parsedQuery.seriesIndustry === "bollywood") {
    //             dispatch(seriesPageNumber_b(parsedQuery.page - 1))
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "series",
    //                 seriesIndustry: "bollywood"
    //             }))
    //         }
    //         else if (parsedQuery.seriesIndustry === "hollywood") {
    //             dispatch(seriesPageNumber_h(parsedQuery.page - 1))
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "series",
    //                 seriesIndustry: "hollywood"
    //             }))
    //         }
    //         else if (parsedQuery.seriesIndustry === "south") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "series",
    //                 seriesIndustry: "south"
    //             }))
    //             dispatch(seriesPageNumber_s(parsedQuery.page - 1))
    //         }
    //         else if (parsedQuery.seriesIndustry === "gujarati") {
    //             dispatch(filterSelection({
    //                 ...filter,
    //                 catagory: "series",
    //                 seriesIndustry: "gujarati"
    //             }))
    //             dispatch(seriesPageNumber_g(parsedQuery.page - 1))
    //         }
    //         loadRecords();

    //     }

    // }, [location])



    return (
        <nav aria-label="Page navigation">
            <ul className="pagination" style={{ overflow: "auto" }}>
                {
                    disPageNumber === 1 ||
                    <li className="page-item">
                        <button className="page-link" aria-label="Previous" onClick={() => pageUpdate(disPageNumber - 1)}>
                            <span className="text-dark" aria-hidden="true">&laquo;</span>
                        </button>
                    </li>
                }
                {
                    totalPageArray.map(number => {
                        return (
                            <li className={disPageNumber === number ? "page-item active" : "page-item"} >
                                <button className={disPageNumber === number ? "page-link bg-dark border-0 rounded-1" : "page-link text-dark"}
                                    value={number}
                                    onClick={() => pageUpdate(number - 1)}
                                >
                                    {number}
                                </button>
                            </li>
                        )
                    })
                }
                {
                    disPageNumber === totalPage ||
                    <li className="page-item">
                        <button className="page-link" aria-label="Next" onClick={() => pageUpdate(disPageNumber + 1)}>
                            <span className="text-dark" aria-hidden="true">&raquo;</span>
                        </button>
                    </li>
                }

            </ul>
        </nav>
    )

}

export default Pagination;