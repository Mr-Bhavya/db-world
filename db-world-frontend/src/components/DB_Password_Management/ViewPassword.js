import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ToastContainer, toast, } from 'react-toastify';
import Authentication from '../Authentication';
import Constants from '../Constants';
import CommonServices from '../CommonServices';
import { v1 as uuidv1 } from 'uuid';
import { deleteCredentialByCredentialId, deleteHostById, getCredential, updateCredential } from '../ApiServices';
import { Button, Modal } from 'react-bootstrap';

function ViewPassword() {

    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [loader, setLoader] = useState(true);
    const [credentialsCache, setCredentialsCache] = useState([]);
    const [credentials, setCredentials] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [updateLoader, setUpdateLoader] = useState(false);
    const [deleteLoader, setDeleteLoader] = useState(false);
    const [deleteModalShow, setDeleteModalShow] = useState(false);
    const [deleteHostLoader, setDeleteHostLoader] = useState(false);
    const [deleteHostModalShow, setDeleteHostModalShow] = useState(false);
    const [editModalShow, setEditModalShow] = useState(false);
    const [formCredential, setFormCredential] = useState({
        // pmId: null,
        pmId: null,
        host: null,
        credentialId: null,
        username: null,
        password: null,
        pin: null,
        notes: null
    })

    const onFieldChange = (e) => {
        setFormCredential({
            ...formCredential,
            [e.target.name]: e.target.value
        })
    }

    const resetFormCredential = () => {
        setFormCredential({
            pmId: null,
            host: null,
            credentialId: null,
            username: null,
            password: null,
            pin: null,
            notes: null
        })
    }

    const togglePassword = (id) => {

        if (document.getElementById(id).type == "text") {
            document.getElementById(id).type = "password";
            document.getElementsByName("togglePassword").value = false;
            // document.getElementById("togglePasswordIcon").src = hidePasswordIcon;
        } else {
            document.getElementById(id).type = "text";;
            document.getElementsByName("togglePassword").value = true;
            // document.getElementById("togglePasswordIcon").src = visiblePasswordIcon;
        }
    }

    const onUpdateCredential = async (e) => {
        e.preventDefault();
        setUpdateLoader(true);
        let { credentialId, pmId, host, username, password, pin, notes } = formCredential;
        pin = pin == "" ? null : pin;
        let updateCredentialRes = await updateCredential(pmId, { id: credentialId, url: `https://${host}`, username, password, pin, notes })
        if (updateCredentialRes.httpStatusCode === 200) {
            toast.success(updateCredentialRes.message);
            getUserCredentials(userData.userId)
        } else if (updateCredentialRes.httpStatusCode === 401) {
            toast.error(updateCredentialRes.message,
                {
                    autoClose: 1000,
                    onClose: () => {
                        navigate(`${Constants.LOGIN_ROUTE}?redirectTo=${Constants.DB_VIEW_PASSWORD_ROUTE}`, { replace: true });
                    }
                });
        } else {
            toast.error(updateCredentialRes.message);
        }
        setUpdateLoader(false);
        handelEditModalClose();
    }


    const getUserCredentials = async (userId) => {
        let getCredentialRes = await getCredential()
        if (getCredentialRes.httpStatusCode === 200) {
            setCredentialsCache(getCredentialRes.data)
            setCredentials(getCredentialRes.data)
        }
        else if (getCredentialRes.httpStatusCode === 401) {
            navigate(await Constants.REDIRECT(Constants.DB_VIEW_PASSWORD_ROUTE));
        }
        else {
            toast.error(getCredentialRes.message)
        }
        setLoader(false);
    }

    const onSearchFieldChange = (e) => {
        let query = e.target.value;
        setSearchQuery(query);
        if (query === "" || query === null || typeof (query) === "undefined") {
            setCredentials(credentialsCache);
        } else {
            setCredentials(credentials.filter(({ host }) => host.toLowerCase().includes(query.toLowerCase())))
        }

        setCredentials(
            query === "" || query === null || typeof (query) === "undefined" ? credentialsCache :
                credentials.filter(({ host, credentials }) => host.toLowerCase().includes(query.toLowerCase()) || credentials.filter(({ username }) => username.toLowerCase().includes(query.toLowerCase())).length > 0)
        )
    }

    useEffect(() => {
        let authenticationRes = Authentication({ redirectTo: Constants.DB_VIEW_PASSWORD_ROUTE });
        if (authenticationRes.login) {
            setUserData(authenticationRes.user);
            getUserCredentials(authenticationRes.user.userId);
        }
        else {
            navigate(authenticationRes.redirectUrl, { replace: true });
        }
    }, [])

    const onDeleteCredential = async () => {
        setDeleteLoader(true);
        let deleteCredentialRes = await deleteCredentialByCredentialId(formCredential?.credentialId)
        if (deleteCredentialRes.httpStatusCode === 200) {
            toast.success(deleteCredentialRes.message);
            getUserCredentials(userData.userId);
        }
        else if (deleteCredentialRes.httpStatusCode === 401) {
            navigate(Constants.REDIRECT(Constants.DB_VIEW_PASSWORD_ROUTE));
        }
        else {
            toast.error(deleteCredentialRes.message);
        }
        setDeleteLoader(false);
        handelDeleteModalClose();
    }

    const onDeleteHost = async (pmId) => {
        setDeleteHostLoader(true);
        try {
            let deleteHostRes = await deleteHostById(pmId);
            if (deleteHostRes.httpStatusCode === 200) {
                toast.success(deleteHostRes.message);
                getUserCredentials(userData.userId);
            }
            else if (deleteHostRes.status === 401) {
                navigate(await Constants.REDIRECT(Constants.DB_VIEW_PASSWORD_ROUTE));
            }
            else {
                toast.error(deleteHostRes.message);
            }
        }
        catch (err) {
            console.log(err);
            toast.error(err);
        }
        setDeleteHostLoader(false);
        handelDeleteHostModalClose();
    }

    const handelDeleteModalClose = () => {
        setDeleteModalShow(false);
        resetFormCredential();
    }

    const handelDeleteHostModalClose = () => {
        setDeleteHostModalShow(false);
        resetFormCredential();
    }
    const handelEditModalClose = () => {
        setEditModalShow(false);
        resetFormCredential();
    }

    const deleteModel =
        <Modal show={deleteModalShow} onHide={handelDeleteModalClose} animation={true}>
            <Modal.Header closeButton>
                <Modal.Title>Delete Credential</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>Are you sure, do you want to delete below credential ? </p>
                <CommonServices.JSONToHTMLTable data={formCredential} />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handelDeleteModalClose}>
                    Close
                </Button>
                {
                    deleteLoader ?
                        <Button variant="danger" onClick={formCredential}>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            &nbsp;&nbsp;&nbsp;&nbsp; Deleteing...
                        </Button>
                        :
                        <Button variant="danger" onClick={onDeleteCredential}>
                            Yes, Delete !!
                        </Button>
                }

            </Modal.Footer>
        </Modal>

    const editModel =
        <Modal show={editModalShow} onHide={handelEditModalClose} animation={true}>
            <Modal.Header closeButton>
                <Modal.Title>Update Credential</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <form>
                    <div className="form-group row mb-2">
                        <label htmlFor="host" className="col-sm-2 col-form-label">Host <span style={{ color: 'red' }}>*</span></label>
                        <div className="col-sm-5">
                            <input type="text" className="form-control" name="host" placeholder='Ex. www.hotstar.com' value={formCredential.host} onChange={onFieldChange} disabled />
                        </div>
                    </div>
                    <div className="form-group row mb-2">
                        <label htmlFor="username" className="col-sm-2 col-form-label">username <span style={{ color: 'red' }}>*</span></label>
                        <div className="col-sm-5">
                            <input type="text" className="form-control" name="username" placeholder='username or email or mobile number' value={formCredential.username} onChange={onFieldChange} disabled />
                        </div>
                    </div>
                    <div className="form-group row mb-2">
                        <label htmlFor="inputPassword" className="col-sm-2 col-form-label">Password <span style={{ color: 'red' }}>*</span></label>
                        <div className="col-sm-5">
                            <input type="password" className="form-control" name="password" id={'password_'} placeholder="Password" value={formCredential.password} onChange={onFieldChange} />
                            {/* <img src={hidePasswordIcon} id="togglePasswordIcon" style={{ marginLeft: "-30px", cursor: "pointer" }} onClick={togglePassword} /> */}
                        </div>
                        <div className="form-check col-sm-3 mx-3 my-2">
                            <input type="checkbox" className="form-check-input" id={'togglePassword_'} name="togglePassword" placeholder="Password" value={false} onChange={() => togglePassword('password_')} />
                            <label htmlFor="togglePassword" className="form-check-lable">Show Password</label>
                        </div>
                    </div>
                    <div className="form-group row mb-2">
                        <label htmlFor="inputPin" className="col-sm-2 col-form-label">Pin</label>
                        <div className="col-sm-5">
                            <input type="text" className="form-control" name="pin" placeholder="Small Pin for mobile app login" value={formCredential.pin} onChange={onFieldChange} />
                        </div>
                    </div>
                    <div className="form-group row mb-2">
                        <label htmlFor="inputnotes" className="col-sm-2 col-form-label">Small notes</label>
                        <div className="col-sm-5">
                            <textarea type="text" className="form-control" name="notes" placeholder="Any notes if you want to add" value={formCredential.notes} onChange={onFieldChange} />
                        </div>
                    </div>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handelEditModalClose}>
                    Close
                </Button>
                {
                    updateLoader &&
                    <Button variant='danger' disabled>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        &nbsp;&nbsp;&nbsp;&nbsp; Updating...
                    </Button>
                    ||
                    <Button variant="danger" onClick={onUpdateCredential}>
                        Save Changes
                    </Button>
                }
            </Modal.Footer>
        </Modal>

    const deleteHostModel =
        <Modal show={deleteHostModalShow} onHide={handelDeleteHostModalClose} animation={true}>
            <Modal.Header closeButton>
                <Modal.Title>Delete Host</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='model-text'>Are you sure, do you want to delete host?</div>
                <div className='model-text'><b>Host: </b>{formCredential.host}</div>
                <hr />
                <div className='model-text text-danger'>*Note: It will delete all credential under this host.</div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handelDeleteHostModalClose}>
                    Close
                </Button>
                {
                    deleteHostLoader ?
                        <Button variant="danger" disabled>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            &nbsp;&nbsp;&nbsp;&nbsp; Deleteing...
                        </Button>
                        :
                        <Button variant="danger" onClick={() => onDeleteHost(formCredential.pmId)}>
                            Yes, Delete
                        </Button>
                }
            </Modal.Footer>
        </Modal>

    return (
        <div className='m-1 p-2' style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>
            <div>
                <Link className='btn btn-outline-light btn-sm' to={Constants.DB_PASSWORD_MANAGER_ROUTE} style={{ float: "left" }}>
                    <img src="https://img.icons8.com/ios-glyphs/30/null/left.png" title="Go Back to Password Management" />
                </Link>
                <center><b><h2>View Credentials</h2></b></center>
            </div>
            <hr />
            {
                loader &&
                <div className='d-flex justify-content-center'>
                    <div className="spinner-border text-danger m-5" role="status">
                        <span className="sr-only text-center"></span>
                    </div>
                </div>
                ||
                <div className='my-5'>

                    <nav className="navbar navbar-light justify-content-end">
                        <form className="form-inline">
                            <input className="form-control border rounded-pill" type="search" aria-label="Search" placeholder="Search Host/Username" value={searchQuery} onChange={onSearchFieldChange} />
                        </form>
                    </nav>

                    {credentials && credentials.length > 0 ?
                        <div className="row row-cols-1 row-cols-md-3 g-3">
                            {
                                credentials.map(({ id, host, credentials }) => {
                                    let pmId = id;
                                    return (
                                        <div className="col">
                                            <div className="card h-100 border-dark">
                                                <div className="card-header">
                                                    {/* <div className='btn btn-sm btn-light' style={{ position: "absolute", top: 0, right: 0, }} type="button" data-bs-toggle="modal" data-bs-target={`#host_${pmId}`}>
                                                        <img style={{ width: "30px" }} src="https://img.icons8.com/fluency/48/null/delete-forever.png" className='' />
                                                    </div> */}
                                                    <Button variant="danger" className='btn btn-sm btn-light' style={{ position: "absolute", top: 0, right: 0, }} onClick={() => {
                                                        setFormCredential({ host, pmId })
                                                        setDeleteHostModalShow(true);
                                                    }}>
                                                        <img style={{ width: "30px" }} src="https://img.icons8.com/fluency/48/null/delete-forever.png" className='' />
                                                    </Button>
                                                    <div className="card-title" >
                                                        <dl className="row">
                                                            <dt className="col-sm-10 float-left">
                                                                <img style={{ width: "30px" }} src={`https://t1.gstatic.com/faviconV2?client=PASSWORD_MANAGER&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=32&url=https%3A%2F%2F${host}` || `https://${host}/favicon.ico`} />
                                                                <span className='m-3'>{host}</span>
                                                            </dt>
                                                        </dl>
                                                    </div>
                                                </div>
                                                <div className="card-body">
                                                    <div className="card-text">
                                                        <ul className="list-group list-group-flush">
                                                            {
                                                                credentials.map(({ id, username, password, pin, notes }) => {
                                                                    let collapseId = 'collapse_' + uuidv1();
                                                                    let editModelId = 'edit_' + uuidv1();
                                                                    let deleteModelId = 'delete_' + uuidv1();
                                                                    let credentialId = id;
                                                                    return (
                                                                        <li className="list-group-item">
                                                                            <button className="btn btn-outline-dark btn-sm" type="button" data-bs-toggle="collapse" data-bs-target={`#${collapseId}`} aria-expanded="false" aria-controls={`${collapseId}`}>
                                                                                <details><summary><b>username:</b> {username}</summary></details>
                                                                            </button>
                                                                            <div className="collapse m-1" id={`${collapseId}`}>
                                                                                <div className="card card-body">
                                                                                    <p><b>username:</b> {username}</p>
                                                                                    <p><b>password:</b> {password}</p>
                                                                                    {pin !== null && pin !== "" && pin !== 0 ? <p><b>pin:</b> {pin}</p> : ""}
                                                                                    {notes !== null && notes !== "" ? <p><b>notes:</b> {notes}</p> : ""}
                                                                                </div>
                                                                                <div className="card-footer">
                                                                                    <div className="btn-toolbar justify-content-end">
                                                                                        <Button variant="warning" size='sm' className='mx-1' onClick={() => {
                                                                                            setFormCredential({
                                                                                                host, username, password, pin, notes, credentialId, pmId
                                                                                            })
                                                                                            setEditModalShow(true);
                                                                                        }}>
                                                                                            Edit</Button>
                                                                                        <Button variant="danger" size='sm' className='mx-1' onClick={() => {
                                                                                            setFormCredential({
                                                                                                host, username, password, pin, notes, credentialId, pmId
                                                                                            })
                                                                                            setDeleteModalShow(true);
                                                                                        }}>
                                                                                            Delete
                                                                                        </Button>

                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </li>
                                                                    )
                                                                })
                                                            }
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                            {/* Edit Modal */}
                            {editModel}
                            {/* Delete Model */}
                            {deleteModel}
                            {/* Delete Host Model */}
                            {deleteHostModel}
                        </div>
                        :
                        <div className="row justify-content-center m-5">
                            <div className="col-12">
                                No Credentials Found.
                            </div>
                        </div>
                    }

                    {Constants.TOAST_CONTAINER}
                    {/* <CommonServices.JSONToHTMLTable data={credentials} /> */}
                </div>

            }

        </div >
    )
}

export default ViewPassword;