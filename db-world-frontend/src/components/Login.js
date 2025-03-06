import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { replace, useNavigate } from 'react-router';
import { useLocation } from 'react-router-dom';
import loginImage from '../images/login.jpg';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Constants from './Constants';
import { doLogin, login, updateDobForUser } from './ApiServices';
import { Button, Form, Modal } from 'react-bootstrap';
import Authentication from '../contexts/Authentication';

function Login() {

    const dispatch = useDispatch();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [loader, setLoader] = useState(false);
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const location = useLocation();
    const redirectTo = getRedirectTo(location);
    const [dob, setDob] = useState();
    const [dobModalShow, setDobModalShow] = useState(false);
    const [user, setUser] = useState(null);
    const [dobError, setDobError] = useState(false);
    const { login, logout } = Authentication.useAuth();

    function getRedirectTo(location) {
        if (location.search) {
            let redirectTo = location.search;
            redirectTo = redirectTo.replaceAll("?redirectTo=", "")
            return redirectTo;
        }
        else
            return null;
    }

    useEffect(() => {

        logout();

        // dispatch(addUser(null));

        // // Local Storage
        // localStorage.setItem('login', false);
        // localStorage.setItem('user', null);
        // localStorage.setItem('token', null);

        // fetch("/api/auth/logout", {
        //     method: "GET",
        //     headers: {
        //         Accept: "application/json",
        //         "Content-Type": "application/json",
        //     },
        //     credentials: "include"
        // }).then((res) => {
        //     if (!res.status === 200) {
        //         const error = new Error(res.error);
        //         throw error;
        //     }
        // }).catch(err => {
        //     console.log(err);
        // });

    }, [])

    const onValidate = async (e) => {
        e.preventDefault();
        setLoader(true);
        if (!email || !password) {
            !email && setEmailError(true)
            !password && setPasswordError(true)
            toast.warning("Please Fill all required field.")
        } else {
            if (!emailError && !passwordError) {
                try {
                    const loginRes = await doLogin(email, password);
                    if (loginRes.httpStatusCode === 200) {
                        login(loginRes?.data?.token, loginRes?.data?.user)
                        toast.success("Login Successfull.", {
                            onClose: () => {
                                if (loginRes.data.user.dob == null) {
                                    setUser(loginRes.data.user);
                                    setDobModalShow(true);
                                } else {
                                    navigate(location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE, {replace: true})
                                }
                                //redirect
                                // redirectTo ? navigate(`${redirectTo}`) : navigate(Constants.DB_WORLD_HOME_ROUTE)
                            },
                            autoClose: 1000
                        });
                        // alert("Login Successfull.")
                        // navigate("/");
                        setLoader(false);
                    }
                    else {
                        toast.error(loginRes.message);
                        setLoader(false);
                    }
                } catch (err) {
                    toast.error('🦄 No Response from Server Side.');
                }
            } else {
                toast.warning("Please Fill correct data.")
            }
        }
        setLoader(false);
    }

    const onChange = (event) => {
        //checkFieldError(event.target.name, event.target.value);
        if (event.target.name === "email") {
            setEmail(event.target.value);
            if (!event.target.value || /[" "]{1,}/.test(event.target.value)) {
                setEmailError(true)
            } else {
                setEmailError(false)
            }
        }
        else if (event.target.name === "password") {
            setPassword(event.target.value);
            if (!event.target.value || /[" "]{1,}/.test(event.target.value)) {
                setPasswordError(true)
            } else {
                setPasswordError(false)
            }
        }
        else if (event.target.name === "dob") {
            setDob(event.target.value);
            var dobPattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
            let year = event.target.value.split("-")[0];
            let currentYear = new Date().getFullYear();
            if (!event.target.value || !dobPattern.test(event.target.value) || year < 1900 || year > currentYear) {
                setDobError(true)
            } else {
                setDobError(false);
            }
        }
    }

    const handleDobModalClose = () => {
        toast.error("Please submit your date of birth");
    }

    const submitDob = async () => {
        let res = await updateDobForUser(dob);
        if (res.httpStatusCode == 200) {
            toast.success("DOB is updated.")
            setDobModalShow(false);
            navigate(location.state?.from?.pathname || Constants.DB_WORLD_HOME_ROUTE)
        } else {
            toast.error(res.message || res.errorMessage);
        }
    }

    const dobModal =
        <Modal show={dobModalShow} onHide={handleDobModalClose} backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>Mendatory Date Of Bith Update</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group>
                        <Form.Label>DOB</Form.Label>
                        <Form.Control name="dob" type="date" format="dd-MM-yyyy" placeholder="Date Of Birth" required
                            onChange={onChange} isInvalid={dobError}
                        />
                        <Form.Control.Feedback type="invalid">
                            Please enter correct date of birth.
                        </Form.Control.Feedback>
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={submitDob}>
                    Submit
                </Button>
            </Modal.Footer>
        </Modal>

    const page = <div className="card mb-3 mt-5 ms-3 me-3 " style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
        <div className="row g-0">
            <div className="col-md-3 mt-5 ms-3 mb-5 me-3">
                <img src={loginImage} className="img-fluid rounded-start" alt="No Photo" style={{ width: "90%" }} />
            </div>
            <div className="col-md-8">
                <div className="card-body mx-3 my-3">
                    <h1 className="card-title">Sign In</h1><hr />
                    <div className="table-responsive mt-5 mb-5" >
                        <form className="form mt-3 mb-3">
                            <div className="row mb-3 ">
                                <label htmlFor="inputEmail3" className="col-sm-2 col-form-label">📧 Email ID <span className="text-danger">*</span></label>
                                <div className="col-sm-10">
                                    {emailError && <>
                                        <input type="email" className="form-control is-invalid" id="inputEmail3" name="email" onChange={onChange} value={email} autoFocus />
                                        <div className="invalid-feedback">Please enter valid email</div>
                                    </>
                                        || <input type="email" className="form-control" id="inputEmail3" name="email" onChange={onChange} value={email} autoFocus />}
                                </div>
                            </div>
                            <div className="row mb-3">
                                <label htmlFor="inputPassword3" className="col-sm-2 col-form-label">🔑 Password <span className="text-danger">*</span></label>
                                <div className="col-sm-10">
                                    {passwordError && <>
                                        <input type="password" className="form-control is-invalid" id="inputPassword3" name="password" onChange={onChange} value={password} />
                                        <div className="invalid-feedback">Password should not be blank or contain white space.</div>
                                    </>
                                        || <input type="password" className="form-control" id="inputPassword3" name="password" onChange={onChange} value={password} />}
                                </div>
                            </div>
                            <hr />
                            <br />
                            <div className="row">
                                <div className="d-flex justify-content-strat mx-3">
                                    {!loader && <button className="btn btn-success btn-sm" type="submit" onClick={onValidate}>Login 🔓</button>
                                        || <button className="btn btn-success btn-sm" type="button" disabled>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            &nbsp;&nbsp;&nbsp;&nbsp; Validating...
                                        </button>}
                                    <button type="submit" className="btn btn-outline-danger btn-sm mx-3" onClick={() => navigate(Constants.DB_WORLD_HOME_ROUTE)}>❌ Cancel</button>
                                </div>
                            </div>
                        </form>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-center mb-3">
                        <p className="card-text md-auto">Not a member ?</p>
                    </div>
                    <div className="d-flex justify-content-center mb-3">
                        <button className="btn btn-outline-primary" type="submit" onClick={() => navigate(Constants.REGISTRATION_ROUTE)}>Create Account 📃</button>
                    </div>
                </div>
            </div>
        </div>
    </div>


    return (
        <>
            {page}
            {dobModal}
            {Constants.TOAST_CONTAINER}
        </>
    )
}

export default Login
