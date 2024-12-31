import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Search from "./Search/Search";
import { useDispatch } from 'react-redux';
import { reloadMovies, searchQuery } from '../../redux/action/allActions'
import Movie from "./Movies/Movie";
import Series from "./Series/Series";
import { useSelector } from "react-redux";
import { filterSelection } from '../../redux/action/allActions'
import LoadingSpinner from "../LoadingSpinner";
import Constants from "../Constants";
import { getGenresList, getUserRole } from "../ApiServices";
import Stream from "./Stream/Stream";
import MyWatchlist from "./MyWatchlist";
import Authentication from "../../contexts/Authentication";
import { Button, Form, Modal } from "react-bootstrap";


function DbCinemaHome() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const userData = useState(useSelector(state => state.userReducer));
    const [isVisible, setIsVisible] = useState(false);
    const filter = useSelector(state => state.filterSelectionReducer)
    const [navLinkActive, setnavLinkActive] = useState(filter.catagory)
    const [loader, setLoader] = useState(false);
    const [userRole, SetUserRole] = useState(Authentication.useAuth()?.auth.role);
    const [searchFieldValue, setSearchFieldValue] = useState("");
    const [isSerachInputEnable, setIsSearchInputEnable] = useState(false);
    const [showGenersModal, setShowGenersModal] = useState(false);
    const [genresList, setGenresList] = useState(null);
    const [selectedGenres, setSelectedGenres] = useState([]);
    const location = useLocation();

    const handelScroll = () => {
        // to enable top button
        if (window.pageYOffset > 0) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const getAllGenres = async () => {

        const res = await getGenresList();
        if (res.httpStatusCode === 200) {
            setGenresList(res.data);
        } else if (res.httpStatusCode === 401) {
            <Navigate to={Constants.LOGIN_ROUTE} state={{ from: location }} />
        }

    }

    const onGenresCheckboxChange = (event) => {
        let value = parseInt(event.target.value);
        if (event.target.checked) {
            setSelectedGenres([...selectedGenres, value]);
        } else {
            setSelectedGenres(selectedGenres.filter((id) => id !== value));
        }
    }

    useEffect(() => {
        window.addEventListener("scroll", handelScroll);
        getAllGenres();
        return () => {
            window.removeEventListener("scroll", handelScroll)
            dispatch(filterSelection({
                ...filter,
                page: 0,
                totalPages: 0
            }))
        }
    }, [])


    const onSearchChange = (e) => {
        e.preventDefault();
        // if search input length is greterthen 3 then only will call backend
        if(e.target.value.length > 2){
            dispatch(searchQuery(e.target.value))
        }
        setSearchFieldValue(e.target.value)
    }

    let searchInput =
        <form class="form-inline" style={{ width: "15rem", display: "inline-block" }} onSubmit={onSearchChange}>
            <div class="input-group">
                <input className="form-control"
                    value={searchFieldValue}
                    defaultValue={searchFieldValue}
                    type="search"
                    placeholder="search movies or series"
                    autoFocus
                    onChange={onSearchChange}
                    style={{ width: "3rem", height: "2rem", }}
                />
                <span class="btn btn-outline-secondary btn-sm" onClick={onSearchChange}>🔍</span>
            </div>
        </form>;

    return (
        <div>
            {
                loader ?
                    <LoadingSpinner />
                    :
                    <div>
                        <div>
                            {isVisible &&
                                <div onClick={scrollToTop}>
                                    <h1 className="mx-3 my-3" style={{
                                        position: "fixed",
                                        bottom: "5px",
                                        right: "5px",
                                        zIndex: "1030"
                                    }} > 🔝 </h1>
                                </div>}
                        </div>
                        <div >

                            <div className="border rounded m-1 p-1" style={{ background: "rgba(255 ,255 ,255, 0.9)" }} role="alert">

                                {
                                    isSerachInputEnable && searchInput
                                    ||
                                    <div style={{ display: "inline" }}>
                                        <b className="">Movies / TV Series</b>
                                        <a
                                            className={"btn btn-outline-secondary btn-sm"}
                                            href="#search" data-toggle="tab"
                                            style={{ float: "right" }}
                                            onClick={() => {
                                                setnavLinkActive("search")
                                                setIsSearchInputEnable(true);
                                            }}
                                        >
                                            🔍
                                        </a>
                                        {
                                            userRole === Constants.ADMIN_USER_ROLE || userRole === Constants.OWNER_USER_ROLE ?
                                                <button type="button" className="btn btn-outline-dark btn-sm mx-5"
                                                    onClick={() => navigate(Constants.ADD_RECORD_ROUTE)}>➕</button>
                                                : ""
                                        }
                                    </div>
                                }
                            </div>

                            <ul className="nav nav-pills border rounded m-1" role="tablist" style={{ background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px", overflowY: "auto", flexWrap: "nowrap", textWrap: "nowrap" }} >
                                <li className="nav-item mx-2 my-1">
                                    <button
                                        className={navLinkActive === "genres" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        to="#genres"
                                        data-toggle="tab"
                                        onClick={() => setShowGenersModal(true)}
                                    >
                                        Genres🔻
                                    </button>

                                    <Modal show={showGenersModal} onHide={() => setShowGenersModal(false)}>
                                        <Modal.Header closeButton>
                                            <Modal.Title>Filter On genres</Modal.Title>
                                        </Modal.Header>
                                        <Modal.Body>
                                            {
                                                genresList ? genresList.map((genres) => {
                                                    return <Form.Check
                                                        inline
                                                        label={genres.name}
                                                        name={genres.name}
                                                        type='checkbox'
                                                        id={genres.id}
                                                        value={genres.id}
                                                        checked={selectedGenres.includes(genres.id)}
                                                        onChange={onGenresCheckboxChange}
                                                    />
                                                }) : ""
                                            }
                                        </Modal.Body>
                                        <Modal.Footer>
                                            <Button variant="secondary" onClick={() => setShowGenersModal(false)}>
                                                Close
                                            </Button>
                                            <Button variant="warning" onClick={() => setSelectedGenres([])}>
                                                Clear Filter
                                            </Button>
                                            <Button variant="primary" onClick={() => {
                                                dispatch(filterSelection({
                                                    ...filter,
                                                    genres: selectedGenres,
                                                    page: 0,
                                                    totalPages: 0
                                                }))
                                                setShowGenersModal(false);
                                                dispatch(reloadMovies())
                                            }}>
                                                Apply
                                            </Button>
                                        </Modal.Footer>
                                    </Modal>

                                </li>
                                <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "movie" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#movie"
                                        data-toggle="tab"
                                        onClick={() => {
                                            // dispatch(reloadMovies())
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("movie")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "movie", page:0, totalPages:0
                                            }))
                                        }
                                        }
                                    >
                                        Movies
                                    </a>
                                </li>
                                <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "series" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#series" data-toggle="tab"
                                        onClick={() => {
                                            // dispatch(reloadMovies())
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("series")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "series", page:0, totalPages:0
                                            }))
                                        }
                                        }
                                    >
                                        Series
                                    </a>
                                </li>
                                <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "watchlist" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#watchlist" data-toggle="tab"
                                        onClick={() => {
                                            // dispatch(reloadMovies())
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("watchlist")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "watchlist", page:0, totalPages:0
                                            }))
                                        }
                                        }
                                    >
                                        My Watchlist
                                    </a>
                                </li>

                                <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "stream" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#stream" data-toggle="tab"
                                        onClick={() => {
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("stream")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "stream", page:0, totalPages:0
                                            }))
                                        }
                                        }
                                    >
                                        Stream
                                    </a>
                                </li>

                            </ul>

                            <div className="tab-content ">
                                <div className={`${navLinkActive === "movie" ? "tab-pane active" : "tab-pane"} m-1`} id="movie">
                                    {
                                        navLinkActive === "movie" ? <Movie userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={`${navLinkActive === "series" ? "tab-pane active" : "tab-pane"} m-1`} id="series">
                                    {
                                        navLinkActive === "series" ? <Series userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={`${navLinkActive === "watchlist" ? "tab-pane active" : "tab-pane"} m-1`} id="watchlist">
                                    {
                                        navLinkActive === "watchlist" ? <MyWatchlist userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={`${navLinkActive === "search" ? "tab-pane active" : "tab-pane"} m-1`} id="search">
                                    {navLinkActive === "search" && <Search userRole={userRole} />}
                                </div>
                                <div className={`${navLinkActive === "stream" ? "tab-pane active" : "tab-pane"} m-1`} id="search">
                                    {navLinkActive === "stream" && <Stream userRole={userRole} />}
                                </div>
                            </div>

                            {Constants.TOAST_CONTAINER}
                        </div >
                    </div>
            }
        </div >
    )

}

export default DbCinemaHome;
