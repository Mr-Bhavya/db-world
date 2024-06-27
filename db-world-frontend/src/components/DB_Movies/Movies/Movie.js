import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import SingleMovie from '../SingleMovie';
import LoadingSpinner from '../../LoadingSpinner';
import { filterSelection } from '../../../redux/action/allActions'
import { useNavigate } from "react-router-dom";
import Constants from "../../Constants";
import { loadDbCinemaRecords } from "../../ApiServices";
import Pagination from "../SubComponents/Pagination";

function Movie(props) {
    const dispatch = useDispatch();
    const [movieList, setMovieList] = useState([])
    const [loading, setLoading] = useState(true);
    const userData = props.userData;
    const userRole = props.userRole;
    const reload = useSelector(state => state.reloadMoviesReducer)
    const moviePageNumberList = useSelector(state => state.moviePageNumberReducer)
    const filter = useSelector(state => state.filterSelectionReducer)
    const [navLinkActive, setNavLinkActive] = useState(filter.movieIndustry);
    const [disPageNumber, setDisPageNumber] = useState(0);
    const [totalPage, setTotalPage] = useState(0);
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
        if (windowSize[0] > 1100 && windowSize[0] < 1500) {
            displayCol = "3";
        } else if (windowSize[0] > 767 && windowSize[0] < 1200) {
            displayCol = "2";
        }
        return displayCol;
    }

    const loadMovies = async () => {
        setLoading(true);
        const response = await loadDbCinemaRecords(filter.movieIndustry, filter.catagory, moviePageNumberList);
        if (response && response.httpStatusCode === 200) {
            setMovieList(response.data.records)
            setDisPageNumber(parseInt(response.data.pageNumber) + 1);
            setTotalPage(parseInt(parseInt(response.data.totalElements) / parseInt(response.data.pageSize))+1);
            setLoading(false);
        } else {
            // alert(response.message);
            navigate(`${Constants.LOGIN_ROUTE}?redirectTo=${Constants.DB_MOVIES_ROUTE}`, { replace: true });
        }
    }

    useEffect(() => {
        onReSize();
        loadMovies();
    }, [reload, filter, moviePageNumberList])

    return (
        <>
            <div className="mb-3 p-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}>
                <ButtonToolbar aria-label="Toolbar with button groups" className="m-1" style={{ overflowX: "auto", flexWrap: "nowrap", textWrap: "nowrap" }}>
                    <ButtonGroup className="mx-2" aria-label="all">
                        <Button
                            variant={filter.movieIndustry === "all" ? "dark" : "outline-secondary"}
                            href="#all"
                            data-toggle="tab"
                            onClick={() => {
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("all")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "all"
                                }))
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
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("bollywood")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "bollywood"
                                }))
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
                                // setNavLinkActive("hollywood")
                                // dispatch(moviePageNumber(0));
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "hollywood"
                                }))
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
                                // setNavLinkActive("hollywood")
                                // dispatch(moviePageNumber(0));
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "korean"
                                }))
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
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("south")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "south"
                                }))
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
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("gujarati")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "movie",
                                    movieIndustry: "gujarati"
                                }))
                            }
                            }
                        >
                            Gujarati
                        </Button>
                    </ButtonGroup>
                </ButtonToolbar>
            </div>

            {!loading &&
                <>
                    <div className="tab-content" id="myTabContent">
                        <div className="tab-pane fade show active" id="all">
                            {/* {content} */}
                            <div className={`row row-cols-1 row-cols-md-${displayCol()} g-4`}>
                                {movieList.sort((a, b) => (a.showOnTop == b.showOnTop ? 0 : (b.showOnTop ? 1 : -1))).map((movie) => {
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

                    <div className="mx-5" >
                        <Pagination filter={filter} page={{ totalPage, disPageNumber }} />
                    </div>
                </>
                ||
                <LoadingSpinner />
            }
        </>
    )

}

export default Movie;
