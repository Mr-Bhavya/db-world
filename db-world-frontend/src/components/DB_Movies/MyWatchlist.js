import React, { useEffect, useState } from "react";
import 'react-toastify/dist/ReactToastify.css';
import SingleMovie from "./SingleMovie";
import { useSelector, useDispatch } from "react-redux";
import LoadingSpinner from "../LoadingSpinner";
import { useNavigate } from "react-router-dom";
import Constants from "../Constants";
import { loadMyWatchlist } from "../ApiServices";

function MyWatchlist(props) {
    const [movieList, setMovieList] = useState([])
    const reload = useSelector(state => state.reloadMoviesReducer)
    const [loading, setLoading] = useState(false);
    const userData = props.userData;
    const userRole = props.userRole;
    const [disPageNumber, setDisPageNumber] = useState(0)
    const [totalPage, setTotalPage] = useState(0);
    const seriesPageNumberList = useSelector(state => state.seriesPageNumberReducer)
    const filter = useSelector(state => state.filterSelectionReducer)
    const [navLinkActive, setNavLinkActive] = useState(filter.seriesIndustry);
    const [windowSize, setWindowSize] = useState([
        window.innerWidth,
        window.innerHeight,
    ]);


    const navigate = useNavigate();

    const onReSize = () => {
        const handleWindowResize = () => {
            setWindowSize([window.innerWidth, window.innerHeight]);
        };
        window.addEventListener('resize', handleWindowResize);
        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }

    const displayCol = () => {
        let displayCol = "4";
        if(windowSize[0] > 1100 && windowSize[0] < 1500){
            displayCol = "3";
        }else if(windowSize[0] > 767 && windowSize[0] < 1200){
            displayCol = "2";
        }
        return displayCol;
    }

    const loadMovies = async () => {
        setLoading(true);
        const response = await loadMyWatchlist(userData.userId);
        if (response && response.httpStatusCode === 200) {
            let watchlistRecord = response.data
            setMovieList(watchlistRecord?.reverse())
            // setDisPageNumber(parseInt(response.data.pageNumber) + 1);
            // setTotalPage(parseInt(parseInt(response.data.totalElements) / parseInt(response.data.pageSize))+1);
            setLoading(false);
        } else {
            alert(response.message);
            navigate(`${Constants.LOGIN_ROUTE}?redirectTo=${Constants.DB_MOVIES_ROUTE}`, { replace: true });
        }


    }

    useEffect(() => {
        onReSize();
        loadMovies();
    }, [reload, filter, seriesPageNumberList])

    return (
        <>

            {!loading &&
                <>
                    <div className="tab-content" id="myTabContent">
                        <div className="tab-pane fade show active" id="all">
                            {/* {content} */}
                            <div className={`row row-cols-1 row-cols-md-${displayCol()} g-4`}>
                                {movieList.map(movie => {
                                    return (
                                        <SingleMovie
                                            movie={movie}
                                            userData={userData}
                                            id={movie.id}
                                            userRole={userRole}
                                        />
                                    )
                                })
                                }
                            </div>
                        </div>
                    </div>

                    {/* <div className="mx-5" >
                        <Pagination filter={filter} page={{ totalPage, disPageNumber }} />
                    </div> */}
                </>
            }
            {loading && <LoadingSpinner />}

        </>
    )
}

export default MyWatchlist;
