import React, { useEffect, useState } from "react";
import 'react-toastify/dist/ReactToastify.css';
import SingleMovie from "./SingleMovie";
import { useSelector, useDispatch } from "react-redux";
import LoadingSpinner from "../LoadingSpinner";
import { useNavigate } from "react-router-dom";
import Constants from "../Constants";
import { loadMyWatchlist } from "../ApiServices";
import { toast } from "react-toastify";
import { Col, Row } from "react-bootstrap";

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
        if (windowSize[0] > 1250 && windowSize[0] < 1550) {
            displayCol = "3";
        } else if (windowSize[0] > 767 && windowSize[0] < 1250) {
            displayCol = "2";
        }
        return displayCol;
    }

    const loadMovies = async () => {
        setLoading(true);
        const response = await loadMyWatchlist(userData.userId);
        if (response && response.httpStatusCode === 200) {
            let watchlistRecord = response.data
            if(watchlistRecord.size == 0){
                toast.warning("You don't have any watchlisted record.")
            }else{
                setMovieList(watchlistRecord?.reverse())
            }
            setLoading(false);
        } else if(response.httpStatusCode === 401 ) {
            navigate(`${Constants.LOGIN_ROUTE}?redirectTo=${Constants.DB_MOVIES_ROUTE}`, { replace: true });
        } else {
            toast.error(response.message)
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
                    <Row xs={12} md={displayCol()} className="m-1">
                        {
                            movieList.sort((a, b) => (a.showOnTop == b.showOnTop ? 0 : (b.showOnTop ? 1 : -1))).map((movie, idx) => (
                                <Col xs="12" key={idx} className="p-0">
                                    <SingleMovie
                                        movie={movie}
                                        userData={userData}
                                        id={movie.id}
                                        userRole={userRole}
                                    />
                                </Col>
                            ))
                        }
                    </Row>
                </>
            }
            {loading && <LoadingSpinner />}
            {Constants.TOAST_CONTAINER}

        </>
    )
}

export default MyWatchlist;
