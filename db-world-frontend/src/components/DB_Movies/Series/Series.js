import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import SingleMovie from "../SingleMovie";
import { useSelector, useDispatch } from "react-redux";
import LoadingSpinner from "../../LoadingSpinner";
import { reloadMovies, seriesPageNumber, filterSelection, seriesPageNumber_b, seriesPageNumber_h, seriesPageNumber_s, seriesPageNumber_g } from '../../../redux/action/allActions'
import { useNavigate } from "react-router-dom";
import Constants from "../../Constants";
import { loadDbCinemaRecords } from "../../ApiServices";
import Pagination from "../SubComponents/Pagination";

function Series(props) {
    const dispatch = useDispatch();
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
        const response = await loadDbCinemaRecords(filter.seriesIndustry, filter.catagory, seriesPageNumberList);
        if (response && response.httpStatusCode === 200) {
            setMovieList(response.data.records)
            setDisPageNumber(parseInt(response.data.pageNumber) + 1);
            setTotalPage(parseInt(parseInt(response.data.totalElements) / parseInt(response.data.pageSize))+1);
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
            <div className="mb-3 p-1" style={{ display: "flex", flexWrap: "nowrap", background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px" }}>
                <ButtonToolbar aria-label="Toolbar with button groups" className="m-1" style={{ overflowX: "auto", flexWrap: "nowrap", textWrap: "nowrap" }}>
                    <ButtonGroup className="mx-2" aria-label="First group">
                        <Button
                            variant={filter.seriesIndustry === "all" ? "dark" : "outline-secondary"}
                            href="#all"
                            data-toggle="tab"
                            onClick={() => {
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("all")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "all"
                                }))
                            }
                            }
                        >All</Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Second group">
                        <Button
                            variant={filter.seriesIndustry === "bollywood" ? "dark" : "outline-secondary"}
                            href="#bollywood"
                            data-toggle="tab"
                            onClick={() => {
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("bollywood")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "bollywood"
                                }))
                            }
                            }
                        >
                            Bollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "hollywood" ? "dark" : "outline-secondary"}
                            href="#hollywood"
                            data-toggle="tab"
                            onClick={() => {
                                // setNavLinkActive("hollywood")
                                // dispatch(moviePageNumber(0));
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "hollywood"
                                }))
                            }
                            }
                        >
                            Hollywood
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "korean" ? "dark" : "outline-secondary"}
                            href="#korean"
                            data-toggle="tab"
                            onClick={() => {
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "korean"
                                }))
                            }
                            }
                        >
                            K-Drama
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "south" ? "dark" : "outline-secondary"}
                            href="#south"
                            data-toggle="tab"
                            onClick={() => {
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("south")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "south"
                                }))
                            }
                            }
                        >
                            South
                        </Button>
                    </ButtonGroup>
                    <ButtonGroup className="mx-2" aria-label="Third group">
                        <Button
                            variant={filter.seriesIndustry === "gujarati" ? "dark" : "outline-secondary"}
                            href="#gujarati"
                            data-toggle="tab"
                            onClick={() => {
                                // dispatch(moviePageNumber(0));
                                // setNavLinkActive("gujarati")
                                dispatch(filterSelection({
                                    ...filter,
                                    catagory: "series",
                                    seriesIndustry: "gujarati"
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

                    <div className="mx-5" >
                        <Pagination filter={filter} page={{ totalPage, disPageNumber }} />
                    </div>
                </>
            }
            {loading && <LoadingSpinner />}

        </>
    )
}

export default Series;
