import React from "react";
import { Link } from "react-router-dom";
import Constants from "../Constants";

function PasswordManagement() {

    return (
        <div className="card mx-3 my-2" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
            <div className="card-header">
                <center><b><h2>Password Management</h2></b></center>
            </div>
            <div className="mx-5">
                <div className="card-body">
                    <h5 className="card-title">Generate Password</h5>
                    <p className="card-text">
                        This will generate password as per requirement.
                        <br />
                        Requirement like Minimum letter, Special Character, Caps and Small Letters etc.
                    </p>
                    <Link to={Constants.DB_GENERATE_PASSWORD_ROUTE} className="btn btn-primary">Generate password page</Link>
                </div>
                <hr />
                <div className="card-body">
                    <h5 className="card-title">Save Password In Database</h5>
                    <p className="card-text">
                        This is page for storing password.
                        <br />
                        Just Save your username and password. and it will secure in our database using ASE key.
                    </p>
                    <Link to={Constants.DB_ADD_PASSWORD_ROUTE} className="btn btn-primary">Save Credntial page</Link>
                </div>
                <hr />
                <div className="card-body">
                    <h5 className="card-title">Saved Password</h5>
                    <p className="card-text">
                        It will show all your saved password.
                        <br />
                        You can get password using correct secure key.
                    </p>
                    <Link to={Constants.DB_VIEW_PASSWORD_ROUTE} className="btn btn-primary">View Password Page</Link>
                    <hr />
                </div>
            </div>
        </div>
    )

}

export default PasswordManagement;