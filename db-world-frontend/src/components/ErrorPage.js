import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Constants from "./Constants";

function ErrorPage() {

    const errorPage = {
        border: "5px groove black",
        margin: "5% 5% 1% 5%",
        //padding:"0%"
    }

    const navigate = useNavigate();

    return (
        <div>
            <div className="alert alert-danger text-center" role="alert" style={errorPage}>
                <h4 className="alert-heading">404 Page Not Found !!</h4>
                <hr />
                <p>Hi User, your entered url and path is not found from server side or invalid. Please correct your url. </p>
                <p>You visiting this web application first time then please register first othervise please login again.</p>
                <b>Thank You for visiting!</b>
                {/* <div className="mx-3">
                    <hr />
                    <p className="mx-3">On Refresh page, You also have to login again. So, Please donot refresh page.</p>
                </div> */}
                {/* <button type="button" className="btn btn-dark" onClick={
                    () => navigate(-1)
                }>◀◀ Go Back</button> */}
                <hr />
                <ul className="list-inline">
                    <li className="list-inline-item">
                        <button type="button" className="btn btn-warning" onClick={
                            () => navigate(Constants.DB_WORLD_HOME_ROUTE)
                        }>Home 🏡</button>
                    </li>
                    <li className="list-inline-item">
                        <Link to={Constants.REGISTRATION_ROUTE}>
                            <button type="button" className="btn btn-primary">Register 📃</button>
                        </Link>
                    </li>
                    <li className="list-inline-item">
                        <Link to={Constants.LOGIN_ROUTE}>
                            <button type="button" className="btn btn-success">Login 🔐</button>
                        </Link>
                    </li>
                </ul>
            </div>
        </div>
    )
}

export default ErrorPage;