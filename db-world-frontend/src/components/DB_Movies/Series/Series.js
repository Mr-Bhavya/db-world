import React, { useEffect, useState } from "react";
import 'react-toastify/dist/ReactToastify.css';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import SingleMovie from "../SingleMovie";
import { useSelector, useDispatch } from "react-redux";
import LoadingSpinner from "../../LoadingSpinner";
import { reloadMovies, filterSelection } from '../../../redux/action/allActions'
import { Navigate, useLocation } from "react-router-dom";
import Constants from "../../Constants";
import { loadDbCinemaRecords } from "../../ApiServices";
import { Col, Row } from "react-bootstrap";
import InfiniteScroll from "react-infinite-scroll-component";

function Series(props) {
    const dispatch = useDispatch();
    const location = useLocation();
    const [movieList, setMovieList] = useState([])
    const reload = useSelector(state => state.reloadMoviesReducer)
    const [loading, setLoading] = useState(false);
    const userData = props.userData;
    const userRole = props.userRole;
    const [totalPage, setTotalPage] = useState(0);
    const filter = useSelector(state => state.filterSelectionReducer)
    const [windowSize, setWindowSize] = useState([
        window.innerWidth,
        window.innerHeight,
    ]);


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
        const response = await loadDbCinemaRecords(filter.seriesIndustry, filter.catagory, filter.genres, filter.page);
        if (response && response.httpStatusCode === 200) {
            if (filter.page == 0) {
                setMovieList(response.data.records)
            } else {
                // let filtered = movieList.filter((item, index) => movieList.indexOf(item) === index)
                setMovieList((prev) => [...prev, ...response.data.records])
                setMovieList((prev) => prev.filter((item, index) => prev.indexOf(item) === index))
            }
            setTotalPage(response?.data?.totalElements)
            dispatch(filterSelection({
                ...filter,
                page: filter.page + 1,
                totalPages: response?.data?.totalElements
            }))
            setLoading(false);
        } else {
            <Navigate to={Constants.DB_WORLD_HOME_ROUTE} state={{ from: location }} />
        }


    }

    const handleIndustryChange = (industry) => {
        setMovieList([]);
        dispatch(filterSelection({
            ...filter,
            catagory: "series",
            seriesIndustry: industry,
            page: 0,
            totalPages: 0
        }))
        dispatch(reloadMovies())
    }

    useEffect(() => {
        setLoading(true);
        loadMovies()
    }, [reload])

    return (
        <InfiniteScroll
            dataLength={movieList.length}
            next={() => loadMovies()}
            hasMore={totalPage !== movieList.length}
            loader={Constants.LOADER}
        >
            <div className="mb-3 p-1 border rounded" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)" }}>
                <ButtonToolbar aria-label="Toolbar with button groups" className="m-1" style={{ overflowX: "auto", flexWrap: "nowrap", textWrap: "nowrap" }}>
                    <ButtonGroup className="mx-2" aria-label="First group">
                        <Button
                            variant={filter.seriesIndustry === "all" ? "dark" : "outline-secondary"}
                            href="#all"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("all")}
                        >All</Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Second group">
                        <Button
                            variant={filter.seriesIndustry === "bollywood" ? "dark" : "outline-secondary"}
                            href="#bollywood"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("bollywood")}                        >
                            Bollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "hollywood" ? "dark" : "outline-secondary"}
                            href="#hollywood"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("hollywood")}
                        >
                            Hollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "korean" ? "dark" : "outline-secondary"}
                            href="#korean"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("korean")}
                        >
                            K-Drama
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "south" ? "dark" : "outline-secondary"}
                            href="#south"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("south")}
                        >
                            South
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "gujarati" ? "dark" : "outline-secondary"}
                            href="#gujarati"
                            data-toggle="tab"
                            onClick={() => handleIndustryChange("gujarati")}
                        >
                            Gujarati
                        </Button>
                    </ButtonGroup>
                </ButtonToolbar>
            </div>

            <Row xs={12} md={displayCol()} className="m-1 p-0">
                {
                    movieList.sort((a, b) => (a.showOnTop == b.showOnTop ? 0 : (b.showOnTop ? 1 : -1))).map((movie, idx) => (
                        <Col xs="12" key={idx} className="p-0" >
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

            {loading && <LoadingSpinner />}

        </InfiniteScroll>
    )
}

export default Series;
