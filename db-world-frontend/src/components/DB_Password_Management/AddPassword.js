import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast, } from 'react-toastify';
import Authentication from '../Authentication';
import CommonServices from '../CommonServices';
import Constants from '../Constants';
import { addCredential, findAllHost, getUserRole } from '../ApiServices';
import { Col, Form, Row } from 'react-bootstrap';

function AddPassword() {

    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [submitLoader, setSubmitLoader] = useState(false);
    const [isValidUrl, setIsValidUrl] = useState(true);
    const [host, setHost] = useState([]);
    const [inputField, setInputField] = useState({
        url: null,
        username: null,
        password: null,
        pin: null,
        notes: null
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
        if (roleRes.httpStatusCode === 401) {
            navigate(await Constants.REDIRECT(Constants.DB_ADD_PASSWORD_ROUTE));
        }
    }

    const getAllHost = async () => {
        let hostRes = await findAllHost();
        if (hostRes.httpStatusCode == 200) {
            setHost(hostRes.data);
        } else if (hostRes.httpStatusCode === 401) {
            navigate(await Constants.REDIRECT(Constants.DB_ADD_PASSWORD_ROUTE));
        }
    }

    useEffect(() => {
        let authenticationRes = Authentication({ redirectTo: Constants.DB_ADD_PASSWORD_ROUTE });
        if (authenticationRes.login) {
            setUserData(authenticationRes.user);
            checkUserRole(authenticationRes.user.userId)
            getAllHost();
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
        let { url, username, password } = inputField;
        inputField.pin = inputField.pin == "" ? null : inputField.pin;
        if (!isvalidateInputField()) {
            toast.warning("One or more filels are incorrect");
        } else if (!url || !username || !password) {
            toast.warning("Please fill all requried fields.");
        }
        else {
            let addCredentialRes = await addCredential(inputField);

            if (addCredentialRes.httpStatusCode === 201) {
                toast.success(addCredentialRes.message);
                getAllHost();
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
                                {/* <label htmlFor="url" className="col-sm-2 col-form-label">Host/Url <span style={{ color: 'red' }}>*</span></label> */}
                                {/* <div className=""> */}
                                {/* <input type="text" className={isValidUrl ? "form-control" : "form-control is-invalid"} id="url" placeholder='Ex. www.hotstar.com' value={inputField.url} onChange={onFieldChange} /> */}
                                <Form.Group as={Row}>
                                    <Form.Label htmlFor='url' column sm="2" className='me-1'>Host/Url <span style={{ color: 'red' }}>*</span></Form.Label>
                                    <Col sm="5">
                                        <Form.Control
                                            list="host"
                                            id="url"
                                            className={isValidUrl ? "form-control" : "form-control is-invalid"}
                                            // isValid = {isValidUrl}
                                            isInvalid = {!isValidUrl}
                                            // defaultValue="pharmacyName"
                                            // {...register("pharmacyLocation")}
                                            // onChange={(e) => e.target.event}
                                            onChange={onFieldChange}
                                            placeholder="Select or Type Host"
                                        // placeholder='Ex. www.hotstar.com'
                                        ></Form.Control>
                                        <datalist id="host">
                                            {host?.map((item) => (
                                                <option key={item} value={`https://${item}/`} >
                                                    {item}
                                                </option>
                                            ))}
                                        </datalist>
                                    </Col>
                                </Form.Group>
                                <div className="invalid-feedback" htmlFor="url">
                                    <ul>
                                        <li>The URL must start with either http or https and</li>
                                        <li>Then followed by :// </li>
                                        <li>Then followed by subdomain of length (2, 256) </li>
                                        <li>Last part contains top level domain like .com, .org etc.</li>
                                    </ul>
                                </div>

                            </div>
                            <div className="form-group row mb-2">
                                <label htmlFor="username" className="col-sm-2 col-form-label">Username <span style={{ color: 'red' }}>*</span></label>
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
                                <label htmlFor="notes" className="col-sm-2 col-form-label">Notes</label>
                                <div className="col-sm-5">
                                    <textarea type="text" className="form-control" id="notes" placeholder="Any notes if you want to add"
                                        rows="4" onChange={onFieldChange}>
                                        {inputField.notes}
                                    </textarea>
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
            {Constants.TOAST_CONTAINER}
        </div>
    )
}

export default AddPassword;