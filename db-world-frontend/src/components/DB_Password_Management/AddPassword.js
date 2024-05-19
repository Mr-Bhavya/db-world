import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import Authentication from '../Authentication';
import CommonServices from '../CommonServices';
import Constants from '../Constants';
import { addCredential, getUserRole } from '../ApiServices';

function AddPassword() {

    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [submitLoader, setSubmitLoader] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(true);
    let hidePasswordIcon = "https://img.icons8.com/material-rounded/24/null/hide.png";
    let visiblePasswordIcon = "https://img.icons8.com/material-rounded/24/null/visible.png";

    const [inputField, setInputField] = useState({
        url: '',
        username: '',
        password: '',
        pin: '',
        discription: ''
    });

    const onFieldChange = (e) => {
        if (e.target.id === "url") {
            setIsValidUrl(CommonServices.isValidUrl(e.target.value) ? true : false);
        }
        setInputField(
            { ...inputField, [e.target.id]: e.target.value }
        )
    }

    const checkUserRole = async (userId) => {
        let roleRes = await getUserRole(userId);
        if(roleRes.httpStatusCode === 401){
            navigate(await Constants.REDIRECT(Constants.DB_ADD_PASSWORD_ROUTE));
        }
    }

    useEffect(() => {
        let authenticationRes = Authentication({ redirectTo: Constants.DB_ADD_PASSWORD_ROUTE });
        if (authenticationRes.login) {
            setUserData(authenticationRes.user);
            checkUserRole(authenticationRes.user.userId)
        }
        else {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }
    }, [])

    const togglePassword = () => {

        if (document.getElementById("password").type == "text") {
            document.getElementById("password").type = "password";
            document.getElementById("togglePassword").value = false;
            // document.getElementById("togglePasswordIcon").src = hidePasswordIcon;
        } else {
            document.getElementById("password").type = "text";;
            document.getElementById("togglePassword").value = true;
            // document.getElementById("togglePasswordIcon").src = visiblePasswordIcon;
        }
    }

    const isvalidateInputField = () => {
        if (isValidUrl) {
            return true;
        } else {
            return false;
        }
    }

    const onSubmit = async (e) => {
        setSubmitLoader(true);
        e.preventDefault();
        let { url, username, password, pin, discription } = inputField;

        if (!isvalidateInputField()) {
            toast.warning("One or more filels are incorrect");
        } else if (!url || !username || !password) {
            toast.warning("Please fill all requried fields.");
        }
        else {
            let addCredentialRes = await addCredential(userData.userId, inputField);

            if (addCredentialRes.httpStatusCode === 201) {
                toast.success(addCredentialRes.message);
            } else if (addCredentialRes.httpStatusCode === 401) {
                toast.error(addCredentialRes.message,
                    {
                        autoClose: 1000,
                        onClose: () => {
                            navigate(`${Constants.LOGIN_ROUTE}?redirectTo=${Constants.DB_ADD_PASSWORD_ROUTE}`, { replace: true });
                        }
                    });
            } else {
                toast.error(addCredentialRes.message);
            }
        }
        setSubmitLoader(false);
    }

    return (
        <div className="card mx-3 my-2" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
            <div className="card-header">
                <Link className='btn btn-outline-light btn-sm' to={Constants.DB_PASSWORD_MANAGER_ROUTE} style={{ float: "left" }}>
                    <img src="https://img.icons8.com/ios-glyphs/30/null/left.png" title="Go Back to Password Management" />
                </Link>
                <center><b><h2>Save Credential</h2></b></center>
            </div>
            <div className="mx-3">
                <div className="card-body">
                    <h5 className="card-title"><u>Save Credential</u></h5>
                    <ul className="card-text">
                        <li>This will Save Password In Database.</li>
                        <li>Worried about security ? No Problem, your credential will secure in our database using <b>Cypher AES Technology</b>.</li>
                        {/* <li>You will get <b>secure key</b> or you can also mack it. Using this one secure key you can access all your saved password.</li> */}
                    </ul>
                    <hr />
                    <div>
                        <form className="needs-validation">
                            <div className="form-group row mb-2">
                                <label htmlFor="url" className="col-sm-2 col-form-label">Host/Url <span style={{ color: 'red' }}>*</span></label>
                                <div className="col-sm-5">
                                    <input type="text" className={isValidUrl ? "form-control" : "form-control is-invalid"} id="url" placeholder='Ex. www.hotstar.com' value={inputField.url} onChange={onFieldChange} />
                                    <div className="invalid-feedback" htmlFor="url">
                                        <ul>
                                            <li>The URL must start with either http or https and</li>
                                            <li>Then followed by :// </li>
                                            {/* <li>then it must contain www. </li> */}
                                            <li>Then followed by subdomain of length (2, 256) </li>
                                            <li>Last part contains top level domain like .com, .org etc.</li>
                                        </ul>
                                    </div>
                                </div>

                            </div>
                            <div className="form-group row mb-2">
                                <label htmlFor="username" className="col-sm-2 col-form-label">username <span style={{ color: 'red' }}>*</span></label>
                                <div className="col-sm-5">
                                    <input type="text" className="form-control" id="username" placeholder='username or email or mobile number' value={inputField.username} onChange={onFieldChange} />
                                </div>
                            </div>
                            <div className="form-group row mb-2">
                                <label htmlFor="inputPassword" className="col-sm-2 col-form-label">Password <span style={{ color: 'red' }}>*</span></label>
                                <div className="col-sm-5">
                                    <input type="password" className="form-control" id="password" placeholder="Password" value={inputField.password} onChange={onFieldChange} />
                                    {/* <img src={hidePasswordIcon} id="togglePasswordIcon" style={{ marginLeft: "-30px", cursor: "pointer" }} onClick={togglePassword} /> */}
                                </div>
                                <div className="form-check col-sm-3 mx-3 my-2">
                                    <input type="checkbox" className="form-check-input" id="togglePassword" placeholder="Password" value={false} onChange={togglePassword} />
                                    <label htmlFor="togglePassword" className="form-check-lable">Show Password</label>
                                </div>
                            </div>
                            <div className="form-group row mb-2">
                                <label htmlFor="inputPassword" className="col-sm-2 col-form-label">Pin</label>
                                <div className="col-sm-5">
                                    <input type="password" className="form-control" id="pin" placeholder="Small Pin for mobile app login" value={inputField.pin} onChange={onFieldChange} />
                                </div>
                            </div>
                            <div className="form-group row mb-2">
                                <label htmlFor="discription" className="col-sm-2 col-form-label">Small Discription</label>
                                <div className="col-sm-5">
                                    <input type="text" className="form-control" id="discription" placeholder="Any Discription if you want to add" value={inputField.discription} onChange={onFieldChange} />
                                </div>
                            </div>
                            <div className="form-group row">
                                <div className="col-sm-5">
                                    <hr />
                                    {
                                        submitLoader &&
                                        <button className="btn btn-dark btn-sm" type="button" disabled>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            &nbsp;&nbsp;&nbsp;&nbsp; Submiting...
                                        </button>
                                        ||
                                        <button type="submit" className="btn btn-dark" onClick={onSubmit}>Submit</button>
                                    }
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
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
        </div>
    )
}

export default AddPassword;