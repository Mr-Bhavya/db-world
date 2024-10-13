import Constants from "./Constants";

function Authentication(props) {

    let redirectUrl = null;
    const user = JSON.parse(localStorage.getItem('user'));
    let login = typeof (user) !== "undefined" && user !== null ? true : false;

    let redirectTo = typeof (props) === "undefined" ? null :
        typeof (props.redirectTo) === "undefined" || props.redirectTo == null ? null : props.redirectTo;
    redirectUrl = `${Constants.LOGIN_ROUTE}${redirectTo == null ? "" : "?redirectTo=" + redirectTo}`;

    return { login, redirectUrl, user }
}

export default Authentication;