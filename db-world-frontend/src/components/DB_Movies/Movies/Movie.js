import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import SingleMovie from '../SingleMovie';
import LoadingSpinner from '../../LoadingSpinner';
import { filterSelection, reloadMovies } from '../../../redux/action/allActions'
import { Navigate, useLocation } from "react-router-dom";
import Constants from "../../Constants";
import { loadDbCinemaRecords } from "../../ApiServices";
import { Col, Row } from "react-bootstrap";
import InfiniteScroll from "react-infinite-scroll-component";

function Movie(props) {
    const dispatch = useDispatch();
    const location = useLocation();
    const [movieList, setMovieList] = useState([])
    const [loading, setLoading] = useState(true);
    const userData = props.userData;
    const userRole = props.userRole;
    const reload = useSelector(state => state.reloadMoviesReducer)
    const filter = useSelector(state => state.filterSelectionReducer)
    const [totalPage, setTotalPage] = useState(0);
    const [windowSize, setWindowSize] = useState([
        window.innerWidth,
        window.innerHeight,
    ]);

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
        const response = await loadDbCinemaRecords(filter.movieIndustry, filter.catagory, filter.genres, filter.page);
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
        setLoading(true);
        setMovieList([]);
        dispatch(filterSelection({
            ...filter,
            catagory: "movie",
            movieIndustry: industry,
            page: 0,
            totalPages: 0
        }))
        dispatch(reloadMovies())
    }

    useEffect(() => {
        loadMovies()
    }, [reload])

    return (
        <InfiniteScroll
            dataLength={movieList.length}
            next={() => loadMovies()}
            hasMore={totalPage !== movieList.length}
            loader={Constants.LOADER}
        >
            <div className="border rounded" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)" }}>
                <ButtonToolbar aria-label="Toolbar with button groups" className="m-1" style={{ overflowX: "auto", flexWrap: "nowrap", textWrap: "nowrap" }}>
                    <ButtonGroup className="mx-2" aria-label="all">
                        <Button
                            variant={filter.movieIndustry === "all" ? "dark" : "outline-secondary"}
                            href="#all"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("all")
                            }
                            }
                        >All</Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="bollywood">
                        <Button
                            variant={filter.movieIndustry === "bollywood" ? "dark" : "outline-secondary"}
                            href="#bollywood"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("bollywood")
                            }
                            }
                        >
                            Bollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="hollywood">
                        <Button
                            variant={filter.movieIndustry === "hollywood" ? "dark" : "outline-secondary"}
                            href="#hollywood"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("hollywood")
                            }
                            }
                        >
                            Hollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="korean">
                        <Button
                            variant={filter.movieIndustry === "korean" ? "dark" : "outline-secondary"}
                            href="#korean"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("korean")
                            }
                            }
                        >
                            K-Drama
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="south">
                        <Button
                            variant={filter.movieIndustry === "south" ? "dark" : "outline-secondary"}
                            href="#south"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("south")
                            }
                            }
                        >
                            South
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="gujarati">
                        <Button
                            variant={filter.movieIndustry === "gujarati" ? "dark" : "outline-secondary"}
                            href="#gujarati"
                            data-toggle="tab"
                            onClick={() => {
                                handleIndustryChange("gujarati")
                            }
                            }
                        >
                            Gujarati
                        </Button>
                    </ButtonGroup>
                </ButtonToolbar>
            </div>

            <Row xs={12} md={displayCol()} className="m-1 p-0">
                {
                    movieList.filter((item, index) => movieList.indexOf(item) === index).sort((a, b) => (a.showOnTop == b.showOnTop ? 0 : (b.showOnTop ? 1 : -1))).map((movie, idx) => (
                        <Col xs="12" key={idx} className="p-0" >
                            <SingleMovie
                                movie={movie}
                                userData={userData}
                                id={movie.recordId}
                                userRole={userRole}
                                idx={idx}
                            />
                        </Col>
                    ))
                }
            </Row>

            {loading && <LoadingSpinner />}

        </InfiniteScroll >
    )

}

export default Movie;
