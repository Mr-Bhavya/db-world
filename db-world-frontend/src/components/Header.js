import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import Constants from './Constants';
import db_world_icon from '../images/db_world_teal.svg';
import { getUserRole } from './ApiServices';
import { addUser } from '../redux/action/allActions';
import CommonServices from './CommonServices';
import Authentication from '../contexts/Authentication';


function Header() {
    const [userData, setUserData] = useState(useSelector(state => state.userReducer));
    const dispatch = useDispatch();
    const location = useLocation();
    const [loader, setLoader] = useState(false);
    const [login, setLogin] = useState(false);
    const [userRole, SetUserRole] = useState();
    const {auth} = Authentication.useAuth();
    const [cardDetails, setCardDetails] = useState([
        {
            index: 1,
            id: "db-world",
            image: "",
            title: "DB World",
            route: Constants.DB_WORLD_HOME_ROUTE,
        },
        {
            index: 2,
            id: "db-weather",
            image: "https://img.icons8.com/clouds/500/null/apple-weather.png",
            title: "Weather & Time",
            route: Constants.DB_WEATHER_ROUTE,
            text: <div>It will show weather information from <b>city</b> name and <b>area pincode</b>. It will also show <b>location on google map</b>.</div>
        },
        {
            index: 3,
            id: "db-password-manager",
            image: "https://img.icons8.com/clouds/500/null/password-window.png",
            title: "Password Manager",
            route: Constants.DB_PASSWORD_MANAGER_ROUTE,
        },
        {
            index: 4,
            id: "db-cinema",
            image: "https://img.icons8.com/clouds/500/null/movies-portal.png",
            title: "DB Cinema",
            route: Constants.DB_MOVIES_ROUTE,
        },
        {
            index: 5,
            id: "db-games",
            image: "https://img.icons8.com/external-others-inmotus-design/500/null/external-Tic-Tac-Toe-round-icons-others-inmotus-design-7.png",
            title: "Games",
            route: Constants.DB_GAMES_ROUTE,
        },
        {
            index: 6,
            id: "db-admin-tool",
            image: "",
            title: "Admin Tool",
            route: Constants.DB_ADMIN_TOOLS_ROUTE,
        },
        {
            index: 7,
            id: "profile",
            image: "",
            title: "Profile",
            route: Constants.USER_PROFILE_ROUTE,
        },
        {
            index: 8,
            id: "edit-profile",
            image: "",
            title: "Profile",
            route: Constants.EDIT_USER_PROFILE_ROUTE,
        },
    ]);

    const getCurrentCard = () => {
        let pathname = location.pathname;
        let card = {};
        let filterdCards = cardDetails.filter(card => card.route === pathname);
        if (filterdCards.length === 0) {
            card.title = "DB World"
            card.id = "db-world"
        } else {
            card = filterdCards.at(0);
        }
        return card;
    }

    const checkUserRole = async (userId) => {

        let roleRes = await getUserRole(userId);
        if (roleRes.httpStatusCode === 200) {
            SetUserRole(roleRes.data.role.name);
        } else if (roleRes.httpStatusCode === 401) {
            setLogin(false)
            dispatch(addUser(null));
            CommonServices.removeUserFromLocal();
        }
    }

    useEffect(() => {
        setLoader(true);
        setLogin(auth.isAuthenticated);
        setLoader(false);
    }, [auth, location.pathname])

    var menu = "";

    if (login) {
        menu = <>
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                    {
                        cardDetails.filter(card => card.index <= 5).map(card => {
                            let currentCard = getCurrentCard();
                            return (
                                <li className="nav-item">
                                    <Link
                                        className={currentCard.id === card.id ? "nav-link active" : "nav-link"}
                                        aria-current="page"
                                        to={card.route}
                                        tabIndex="-1"
                                        aria-disabled={currentCard.id === card.id ? "true" : "false"}
                                        onClick={() => document.title = card.route === Constants.DB_WORLD_HOME_ROUTE ? card.title : "DB World | " + card.title}
                                    >
                                        {card.title}
                                    </Link>
                                </li>
                            )

                        })
                    }
                </ul>
                <ul className="nav navbar-nav navbar-right me-5">
                    <li className="nav-item dropdown me-5">
                        <Link className="nav-link dropdown-toggle" to={Constants.USER_PROFILE_ROUTE} id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            👱‍♂️ {userData?.name}
                        </Link>
                        <ul className="dropdown-menu" aria-labelledby="navbarDropdown">
                            <li><Link className="dropdown-item" to={Constants.USER_PROFILE_ROUTE}>My Profile</Link></li>
                            {
                                auth?.role === Constants.OWNER_USER_ROLE || auth?.role === Constants.ADMIN_USER_ROLE ?
                                    <li><Link className="dropdown-item" to={Constants.DB_ADMIN_TOOLS_ROUTE} state={userRole}>Admin Tools</Link></li>
                                    : ""
                            }
                            <li><Link className="dropdown-item" to={Constants.LOGOUT_ROUTE}>Logout</Link></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </>
    }
    else {
        menu =
            <div className="collapse navbar-collapse" id="navbarSupportedContent">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                    <li className="nav-item">
                        <Link className="nav-link active" aria-current="page" to={Constants.DB_WORLD_HOME_ROUTE}>Home</Link>
                    </li>
                    <li className="nav-item">
                        <Link className="nav-link" to={Constants.REGISTRATION_ROUTE}>Registration 📃</Link>
                    </li>
                    <li className="nav-item">
                        <Link className="nav-link" to={Constants.LOGIN_ROUTE}>Login 🔐</Link>
                    </li>
                </ul>
            </div>
    }

    return (
        !loader &&
        <div>
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
                <div className="container-fluid">
                    <Link className="navbar-brand" to={Constants.DB_WORLD_HOME_ROUTE}>
                        <img src={db_world_icon} className="d-inline-block align-top rounded-circle" width="50" height="50" style={{ backgroundColor: "rgb(203, 237, 232)" }} />
                    </Link>
                    <Link className="navbar-brand" to={location.pathname + location.search}>
                        <h5 className="d-inline-block align-top"> {getCurrentCard().title} </h5>
                    </Link>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    {menu}
                </div>
            </nav>
        </div>
        ||
        <LoadingSpinner />
    )
}

export default Header;