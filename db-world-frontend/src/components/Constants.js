import { ToastContainer } from "react-toastify";
import { v1 as uuidv1 } from 'uuid';

const RE_LOGIN = " Please Relogin";
const ADD_RECORD_API = "/api/media/add/record";
const ADD_USER_API = "/api/auth/add";
const ADD_PASSWORD_API = "/api/user/add_password";
const UPDATE_PASSWORD_API = "/api/user/update_password";
const DELETE_PASSWORD_API = "/api/user/delete_password";
const DELETE_HOST_API = "/api/user/delete_host";
const FIND_ALL_USERS_API = "/api/user/findAll";
const DELETE_USER_API = "/api/user/delete";
const EDIT_USER_API = "/api/user/edit";
const USER_ROLE_API = "/api/user/user_role";
const UPDATE_USER_ROLE_API = "/api/user/update_user_role";
const MIRROR_API = "/api/media/mirror";
const VALIDATE_TOKEN_API = "/api/validateToken";
const DELETE_ICON_URL = "https://img.icons8.com/material-rounded/48/null/delete-forever.png";
const VIEW_USER_ICON_URL = "https://img.icons8.com/material-sharp/24/null/contract-job.png";
const DB_MOVIES_ROUTE = "/db-world/db-cinema"; // db-world/db-movies?catagory=movie&movieIndustry=all&page=2
const DB_MOVIE_DETIALS_ROUTE = DB_MOVIES_ROUTE + "/movie";
const DB_SERIES_DETIALS_ROUTE = DB_MOVIES_ROUTE + "/series";
const DB_WORLD_HOME_ROUTE = "/db-world";
const DB_WEATHER_ROUTE = "/db-world/db-weather";
const DB_GAMES_ROUTE = "/db-world/db-games";
const DB_PASSWORD_MANAGER_ROUTE = "/db-world/db-password-manager";
const DB_GENERATE_PASSWORD_ROUTE = DB_PASSWORD_MANAGER_ROUTE + "/generate-password";
const DB_ADD_PASSWORD_ROUTE = DB_PASSWORD_MANAGER_ROUTE + "/add-password";
const DB_VIEW_PASSWORD_ROUTE = DB_PASSWORD_MANAGER_ROUTE + "/view-password";
const LOGIN_ROUTE = '/db-world/login';
const LOGOUT_ROUTE = '/db-world/logout';
const USER_PROFILE_ROUTE = "/db-world/user-profile";
const EDIT_USER_PROFILE_ROUTE = "/db-world/user-profile-edit";
const REGISTRATION_ROUTE = '/db-world/registration';
const DB_ADMIN_TOOLS_ROUTE = '/db-world/admin-tools';
const EDIT_RECORD_ROUTE = DB_MOVIES_ROUTE + '/edit-record';
const ADD_RECORD_ROUTE = DB_ADMIN_TOOLS_ROUTE + '#active=records';
const DB_WORLD_TEAL_SVG_ICON = '../../public/svgs/db_world_teal.svg';
const OWNER_USER_ROLE = "OWNER";
const ADMIN_USER_ROLE = "ADMIN";
const VIEWER_USER_ROLE = "VIEWER";
const KIB = "KiB";
const MIB = "MiB";
const GIB = "GIB";
const RECORD_TYPE_MOVIE = "movie";
const RECORD_TYPE_SERIES = "series";
const REDIRECT = async (redirectTo) => {
    return redirectTo ? `${LOGIN_ROUTE}?redirectTo=` + redirectTo : LOGIN_ROUTE
}
const LOADER = <div className="col-md-12">
    <div className='d-flex justify-content-center'>
        <div className="spinner-border text-danger m-5" role="status">
            <span className="sr-only text-center" />
        </div>
    </div>
</div>

const BUTTON_LOADER = (buttonColor, diaplayText) => {
    return (<button className={`btn btn-${buttonColor} btn-sm`} type="button" disabled>
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        &nbsp;&nbsp;&nbsp;&nbsp; {diaplayText + "..."}
    </button>)
}

const TOAST_CONTAINER = <ToastContainer
    // containerId={`toast_` + uuidv1()}
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

export default {
    RE_LOGIN,
    ADD_RECORD_API,
    ADD_USER_API,
    ADD_PASSWORD_API,
    UPDATE_PASSWORD_API,
    DELETE_PASSWORD_API,
    DELETE_HOST_API,
    FIND_ALL_USERS_API,
    DELETE_USER_API,
    EDIT_USER_API,
    USER_ROLE_API,
    UPDATE_USER_ROLE_API,
    MIRROR_API,
    VALIDATE_TOKEN_API,
    DELETE_ICON_URL,
    VIEW_USER_ICON_URL,
    DB_WORLD_HOME_ROUTE,
    DB_MOVIES_ROUTE,
    DB_MOVIE_DETIALS_ROUTE,
    DB_SERIES_DETIALS_ROUTE,
    DB_WEATHER_ROUTE,
    DB_GAMES_ROUTE,
    DB_PASSWORD_MANAGER_ROUTE,
    DB_GENERATE_PASSWORD_ROUTE,
    DB_ADD_PASSWORD_ROUTE,
    DB_VIEW_PASSWORD_ROUTE,
    DB_ADMIN_TOOLS_ROUTE,
    LOGIN_ROUTE,
    LOGOUT_ROUTE,
    USER_PROFILE_ROUTE,
    EDIT_USER_PROFILE_ROUTE,
    ADD_RECORD_ROUTE,
    EDIT_RECORD_ROUTE,
    REGISTRATION_ROUTE,
    DB_WORLD_TEAL_SVG_ICON,
    OWNER_USER_ROLE,
    ADMIN_USER_ROLE,
    VIEWER_USER_ROLE,
    KIB, MIB, GIB,
    REDIRECT,
    LOADER,
    BUTTON_LOADER,
    TOAST_CONTAINER,
    RECORD_TYPE_SERIES,
    RECORD_TYPE_MOVIE
};