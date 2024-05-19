import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Search from "./Search/Search";
import { useDispatch } from 'react-redux';
import { searchQuery } from '../../redux/action/allActions'
import Movie from "./Movies/Movie";
import Series from "./Series/Series";
import { useSelector } from "react-redux";
import { filterSelection } from '../../redux/action/allActions'
import Authentication from "../Authentication";
import LoadingSpinner from "../LoadingSpinner";
import Constants from "../Constants";
import { getUserRole } from "../ApiServices";
import Stream from "./Stream/Stream";
import MyWatchlist from "./MyWatchlist";


function MovieHome() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [isVisible, setIsVisible] = useState(false);
    const query = useSelector(state => state.searchReducer);
    const filter = useSelector(state => state.filterSelectionReducer)
    const [navLinkActive, setnavLinkActive] = useState(filter.catagory)
    const [loader, setLoader] = useState(true);
    const [userRole, SetUserRole] = useState();
    const [searchFieldValue, setSearchFieldValue] = useState("");
    const [isSerachInputEnable, setIsSearchInputEnable] = useState(false);

    const toggleVisibility = () => {
        if (window.pageYOffset > 0) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const checkUserRole = async (userId) => {

        let roleRes = await getUserRole(userId);
        if (roleRes.httpStatusCode === 200) {
            SetUserRole(roleRes.data.role.name);
            setLoader(false);
        } else if (roleRes.httpStatusCode === 401 || roleRes.httpStatusCode === 400) {
            navigate(await Constants.REDIRECT(Constants.DB_MOVIES_ROUTE), { replace: true });
        } else{
            toast.error(roleRes.message)
        }
    }

    useEffect(() => {
        setLoader(true);
        let authenticationRes = Authentication({ redirectTo: Constants.DB_MOVIES_ROUTE });
        if (authenticationRes.login) {
            setUserData(authenticationRes.user);
            window.addEventListener("scroll", toggleVisibility);
            checkUserRole(authenticationRes.user.userId);
        }
        else {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }
    }, [])


    const onSearchChange = (e) => {
        e.preventDefault();
        dispatch(searchQuery(searchFieldValue));
        setIsSearchInputEnable(false);
    }

    let searchInput =
        <form class="form-inline" style={{ width: "15rem", display: "inline-block" }} onSubmit={onSearchChange}>
            <div class="input-group">
                <input className="form-control"
                    value={searchFieldValue}
                    defaultValue={query}
                    type="search"
                    placeholder="search movies or series"
                    // aria-label=""
                    autoFocus
                    onChange={(e) => setSearchFieldValue(e.target.value)}
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
                        <div style={{ margin: "1%" }}>

                            <div className="alert alert-dark" style={{ background: "rgba(255 ,255 ,255, 0.9)" }} role="alert">

                                {
                                    isSerachInputEnable && searchInput
                                    ||
                                    <div style={{ display: "inline" }}>
                                        <b className="alert-heading">Movies / TV Series</b>
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

                            <ul className="nav nav-pills mb-3" role="tablist" style={{ background: "rgba(255 ,255 ,255, 0.9)", borderRadius: "3px", overflow: "auto", flexWrap: "nowrap", textWrap:"nowrap" }} >
                                <li className="nav-item mx-2 my-1">
                                    <button
                                        className={navLinkActive === "movie" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        to="#movie"
                                        data-toggle="tab"
                                        onClick={() => {
                                            // dispatch(reloadMovies())
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("movie")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "movie"
                                            }))
                                        }
                                        }
                                    >
                                        Movies
                                    </button>
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
                                                ...filter, catagory: "series"
                                            }))
                                        }
                                        }
                                    >
                                        Series
                                    </a>
                                </li>
                                <li className="nav-item mx-2 my-1">
                                    <button
                                        className={navLinkActive === "watchlist" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#watchlist" data-toggle="tab"
                                        onClick={() => {
                                            // dispatch(reloadMovies())
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("watchlist")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "watchlist"
                                            }))
                                        }
                                        }
                                    >
                                        My Watchlist
                                    </button>
                                </li>

                                <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "stream" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#stream" data-toggle="tab"
                                        onClick={() => {
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("stream")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "stream"
                                            }))
                                        }
                                        }
                                    >
                                        Stream
                                    </a>
                                </li>

                                {/* <li className="nav-item mx-2 my-1">
                                    <a
                                        className={navLinkActive === "index" ? "btn btn-dark" : "btn btn-outline-secondary"}
                                        href="#index" data-toggle="tab"
                                        onClick={() => {
                                            setIsSearchInputEnable(false);
                                            setnavLinkActive("index")
                                            dispatch(filterSelection({
                                                ...filter, catagory: "index"
                                            }))
                                        }
                                        }
                                    >
                                        Index
                                    </a>
                                </li> */}

                            </ul>

                            <div className="tab-content">
                                {
                                    navLinkActive === "movie"
                                }
                                <div className={navLinkActive === "movie" ? "tab-pane active" : "tab-pane"} id="movie">
                                    {
                                        navLinkActive === "movie" ? <Movie userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={navLinkActive === "series" ? "tab-pane active" : "tab-pane"} id="series">
                                    {
                                        navLinkActive === "series" ? <Series userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={navLinkActive === "watchlist" ? "tab-pane active" : "tab-pane"} id="watchlist">
                                    {
                                        navLinkActive === "watchlist" ? <MyWatchlist userData={userData} userRole={userRole} /> : ""
                                    }
                                </div>
                                <div className={navLinkActive === "search" ? "tab-pane active" : "tab-pane"} id="search">
                                    {navLinkActive === "search" && <Search userRole={userRole} />}
                                </div>
                                <div className={navLinkActive === "stream" ? "tab-pane active" : "tab-pane"} id="search">
                                    {navLinkActive === "stream" && <Stream userRole={userRole} />}
                                </div>
                                {/* <div className={navLinkActive === "index" ? "tab-pane active" : "tab-pane"} id="search">
                                    {navLinkActive === "index" && <DbMoviesIndex />}
                                </div> */}
                            </div>

                            <ToastContainer
                                position="top-right"
                                autoClose={5000}
                                hideProgressBar={false}
                                newestOnTop={true}
                                closeOnClick
                                rtl={false}
                                pauseOnFocusLoss
                                draggable
                                pauseOnHover
                            />
                        </div >
                    </div>
            }
        </div>
    )

}

export default MovieHome;
