import React, { useEffect, useState } from 'react';
import { Button, Card, CardGroup, Col, Form, Row, Table } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import CommonServices from '../CommonServices';
import Constants from '../Constants';
import { ToastContainer, toast } from 'react-toastify';
import { deleteUser, updateUserDetails } from '../ApiServices';
import { findAllUsers } from '../../redux/action/allActions';

const UsersData = () => {

    const dispatch = useDispatch();
    const users = useSelector(state => state.userReducer.users);
    const [userData, setUserData] = useState(useSelector(state => state.userReducer.users));
    const DOWN_ARROW_ICON = "https://img.icons8.com/ios-glyphs/90/sort-down.png";
    const UP_ARROW_ICON = "https://img.icons8.com/ios-glyphs/90/sort-up.png";
    const [expandUser, setExpandUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loader, setLoader] = useState(true);
    const [editUserBody, setEditUserBody] = useState({});

    const onSearchQueryChange = (query) => {
        setUserData(
            query === "" || query === null || typeof (query) === "undefined" ? users :
                users?.filter(({ userId, email, firstName, lastName, mobileNo }) =>
                    userId?.toString().toLowerCase().includes(query.toLowerCase()) ||
                    email?.toLowerCase().includes(query.toLowerCase()) ||
                    firstName?.toLowerCase().includes(query.toLowerCase()) ||
                    lastName?.toLowerCase().includes(query.toLowerCase()) ||
                    mobileNo?.toString().toLowerCase().includes(query.toLowerCase())
                )
        )
        return userData;
    }

    const onChangeData = (e) => {
        let user = users.filter(({ userId }) => userId === expandUser).at[0];
        setEditUserBody({ ...user, [e.target.id]: e.target.value })
    }

    const onUpdateUserDetails = async (updatedUser) => {
        updatedUser = { ...updatedUser, ...editUserBody }
        let { userId, email, firstName, lastName, mobileNo, dob, gender, password } = updatedUser;
        let updateUserRes = await updateUserDetails({ userId, email, firstName, lastName, mobileNo, dob, gender, password });
        if (updateUserRes.httpStatusCode === 200) {
            toast.success("User updated.")
            dispatch(findAllUsers(users.map(user => {
                if (user.userId === updatedUser.userId) {
                    user = updatedUser
                }
                return user;
            })))
        }
        else if (updateUserRes.httpStatusCode === 401) {
            // toast.error(updateUserRes.message);
        } else {
            toast.error(updateUserRes.message);
        }
    }

    useEffect(() => {
        onSearchQueryChange(searchQuery);
        setLoader(
            users && users.length && users.length >= 0 ? false : true
        )
    }, [users, searchQuery])

    const editUserModel = (user, editModelId) => {
        return (
            <div className="modal fade" id={editModelId} tabIndex="-1" role="dialog" aria-labelledby={`${editModelId}Label`} aria-hidden="true">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title" id={editModelId}>Update {user.firstName} Information</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setEditUserBody({})}></button>
                        </div>
                        <div className="modal-body">
                            <Form>

                                <Form.Group as={Row} className="mb-3" controlId="email">
                                    <Form.Label column sm={2}>Email</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="email" defaultValue={user.email} plaintext disabled readOnly />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="firstName">
                                    <Form.Label column sm={2}>First Name</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="text" placeholder={user.firstName}
                                            value={editUserBody.firstName}
                                            onChange={onChangeData} />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="lastName">
                                    <Form.Label column sm={2}>Last Name</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="text" placeholder={user.lastName} value={editUserBody.lastName} onChange={onChangeData} />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="mobileNo">
                                    <Form.Label column sm={2}>Contact Number</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="text" placeholder={user.mobileNo} value={editUserBody.mobileNo} onChange={onChangeData} />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="dob">
                                    <Form.Label column sm={2}>DOB</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="date" placeholder={user.dob} value={editUserBody.dob} onChange={onChangeData} />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="gender">
                                    <Form.Label column sm={2}>Gender</Form.Label >
                                    <Col sm={10}>
                                        <Form.Check
                                            type="radio"
                                            label="Male"
                                            name="gender"
                                            id="male"
                                            value="male"
                                            defaultChecked={user.gender.toLowerCase() === "male"}

                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Female"
                                            name="gender"
                                            id="female"
                                            value="female"
                                            defaultChecked={user.gender.toLowerCase() === "female"}
                                        />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className="mb-3" controlId="password">
                                    <Form.Label column sm={2}>Site Password</Form.Label>
                                    <Col sm={10}>
                                        <Form.Control type="text" placeholder={user.password} value={editUserBody.password} onChange={onChangeData} />
                                    </Col>
                                </Form.Group>

                            </Form>
                        </div>
                        <div className="modal-footer">
                            <Button type="submit" className="btn btn-primary btn-sm "
                                onClick={() => onUpdateUserDetails(user)}
                            >Update Details</Button>
                            <button type="button" className="btn btn-secondary btn-sm " data-bs-dismiss="modal"
                                onClick={() => setEditUserBody({})}
                            >Close</button>
                            {/* {
                                    updateLoader &&
                                    <button className="btn btn-danger btn-sm" type="button" disabled>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        &nbsp;&nbsp;&nbsp;&nbsp; Updating...
                                    </button>
                                    ||
                                    <button type="button" className="btn btn-danger btn-sm" onClick={onUpdateCredential}>Update</button>
                                } */}
                        </div>
                    </div>
                </div>

            </div>
        )
    }

    const deleteCurrentUser = async (user) => {
        toast.warning("Puser pocessed for delete")
        let deleteUserRes = await deleteUser(user.userId);
        if (deleteUserRes.httpStatusCode === 200) {
            toast.success("User Deleted");
            dispatch(findAllUsers(userData.filter(userdata => userdata.userId != user.userId)));
        } else if (deleteUserRes.httpStatusCode === 401) {
            // 
        } else {
            toast.error(deleteUserRes?.message || deleteUserRes?.error);
        }
    }

    return (
        <div className="bg-transparent pb-5">

            {
                loader ? Constants.LOADER :
                    <div>
                        <nav className="navbar navbar-light justify-content-end">
                            <form className="form-inline" onSubmit={(e) => e.preventDefault()}>
                                <input className="form-control border rounded-pill" type="search" aria-label="Search" placeholder="Search With any keyword" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </form>
                        </nav>


                        <CardGroup>
                            {userData.map((user, idx) => {
                                return (
                                    <Col key={idx}>

                                        <div className="accordion" id="user_info">
                                            <Card className='m-1'>
                                                <Card.Header id={`heading${user.userId}`}>
                                                    <div className="position-relative">
                                                        <button className="position-absolute top-0 end-0 btn btn-link collapsed p-0"
                                                            data-toggle="collapse"
                                                            data-target={`#collapse${user.userId}`}
                                                            aria-expanded="false"
                                                            aria-controls={`collapse${user.userId}`}
                                                        >
                                                            <img width="30" height="30"
                                                                src={expandUser === user.userId ? UP_ARROW_ICON : DOWN_ARROW_ICON}
                                                                alt={expandUser === user.userId ? "sort-up" : "sort-down"}
                                                                onClick={() => setExpandUser(expandUser === user.userId ? null : user.userId)} />
                                                        </button>

                                                    </div>
                                                    <div className="mb-0 ms-3">
                                                        <div className="position-absolute top-0 start-0 rounded bg-dark text-white p-1">
                                                            {idx + 1}
                                                        </div>
                                                        <b>{user.firstName} {user.lastName}</b>
                                                    </div>
                                                </Card.Header>
                                                {
                                                    expandUser === user.userId ? "" :
                                                        <Card.Body>
                                                            <Card.Text>
                                                                <Table responsive="sm">
                                                                    <tbody>
                                                                        <tr>
                                                                            <th>id:</th>
                                                                            <td>{user.userId}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <th>Email:</th>
                                                                            <td>{user.email}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <th>Contact No:</th>
                                                                            <td>{user.mobileNo}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </Table>
                                                            </Card.Text>
                                                        </Card.Body>
                                                }


                                                <div id={`collapse${user.userId}`} className={expandUser === user.userId ? "collapse show" : "collapse"} aria-labelledby={`heading${user.userId}`} data-parent="#user_info">
                                                    {
                                                        expandUser === user.userId &&
                                                        <div>
                                                            <Card.Body>
                                                                <Card.Text>
                                                                    <Table responsive="sm">
                                                                        <tbody>
                                                                            <tr>
                                                                                <th>id:</th>
                                                                                <td>{user.userId}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>First Name:</th>
                                                                                <td>{user.firstName}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>Last Name:</th>
                                                                                <td>{user.lastName}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>Email:</th>
                                                                                <td>{user.email}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>Contact No:</th>
                                                                                <td>{user.mobileNo}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>Gender:</th>
                                                                                <td>{user.gender}</td>
                                                                            </tr>
                                                                            {
                                                                                user.dob ?
                                                                                    <tr>
                                                                                        <th>DOB:</th>
                                                                                        <td>{user.dob}</td>
                                                                                    </tr>
                                                                                    :
                                                                                    <tr>
                                                                                        <th>Age:</th>
                                                                                        <td>{user.age}</td>
                                                                                    </tr>
                                                                            }
                                                                            <tr>
                                                                                <th>No. of login</th>
                                                                                <td>{user?.noOfLogin}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>Site Password:</th>
                                                                                <td>{user.password}</td>
                                                                            </tr>
                                                                            <tr>
                                                                                <th>User Role:</th>
                                                                                <td>{user.userRole?.name}</td>
                                                                            </tr>
                                                                            {
                                                                                user.loginData && user.loginData.length > 0 ?
                                                                                    <tr>
                                                                                        <th>User Last 5 Login:</th>
                                                                                        <td>
                                                                                            <table className='table table-sm table-bordered table-striped'>
                                                                                                {user.loginData.map((data, idx) => {
                                                                                                    <tr>
                                                                                                        <td>
                                                                                                            {data.lastLoginDate}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                    if (typeof (data.lastLoginDate) !== 'object') {
                                                                                                        return (
                                                                                                            <tr>
                                                                                                                <td>
                                                                                                                    {data.lastLoginDate}
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        )
                                                                                                    }
                                                                                                })}
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    :
                                                                                    ""
                                                                            }
                                                                            {
                                                                                user.cinemaData && user.cinemaData != null && user?.cinemaData?.events?.download_files && user?.cinemaData?.events?.download_files.length > 0 ?

                                                                                    <tr>
                                                                                        <th>Downloaded Files: </th>
                                                                                        <td>
                                                                                            <table className='table table-sm table-bordered table-striped'>
                                                                                                {
                                                                                                    user?.cinemaData?.events?.download_files.map(file => {
                                                                                                        return (<tr><td> {file} </td> </tr>)
                                                                                                    })
                                                                                                }
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    : ""
                                                                            }
                                                                            {
                                                                                user.cinemaData && user.cinemaData != null && user?.cinemaData?.events?.stream_files && user?.cinemaData?.events?.stream_files.length > 0 ?
                                                                                    <tr>
                                                                                        <th>Stream Files: </th>
                                                                                        <td>
                                                                                            <table className='table table-sm table-bordered table-striped'>
                                                                                                {
                                                                                                    user?.cinemaData?.events?.stream_files.map(file => {
                                                                                                        return (<tr><td> <b>==&gt;</b>{file} </td> </tr>)
                                                                                                    })
                                                                                                }
                                                                                            </table>
                                                                                        </td>
                                                                                    </tr>
                                                                                    : ""
                                                                            }
                                                                            {
                                                                                user.cinemaData && user.cinemaData != null && user?.cinemaData?.events?.search_keywords && user?.cinemaData?.events?.search_keywords.length > 0 ?
                                                                                    <tr>
                                                                                        <th>search_keywords: </th>
                                                                                        <td>
                                                                                            {
                                                                                                user?.cinemaData?.events?.search_keywords.join(", ")
                                                                                            }
                                                                                        </td>
                                                                                    </tr>
                                                                                    : ""
                                                                            }
                                                                        </tbody>
                                                                    </Table>
                                                                </Card.Text>
                                                            </Card.Body>
                                                            <Card.Footer>
                                                                <div className="btn-toolbar justify-content-end">
                                                                    <button className="btn btn-warning btn-sm mx-2" type="button" data-bs-toggle="modal" data-bs-target={`#editModal_${user.userId}`}
                                                                        onClick={() => setEditUserBody(user)}
                                                                    >Edit</button>
                                                                    <button className="btn btn-danger btn-sm mx-2" type="button" data-bs-toggle="modal" data-bs-target={`#deleteModel_${user.userId}`}
                                                                    >Delete</button>

                                                                    {editUserModel(user, `editModal_${user.userId}`)}

                                                                    <div class="modal fade" id={`deleteModel_${user.userId}`} tabindex="-1" aria-labelledby={`deleteModel_${user.userId}Label`} aria-hidden="true">
                                                                        <div class="modal-dialog">
                                                                            <div class="modal-content">
                                                                                <div class="modal-header">
                                                                                    <h1 class="modal-title fs-5" id={`deleteModel_${user.userId}`}>Delete User Conformation</h1>
                                                                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                                                                </div>
                                                                                <div class="modal-body">
                                                                                    Do you want to delete <b>{user.email}</b> user from database ?
                                                                                </div>
                                                                                <div class="modal-footer">
                                                                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                                                                    <button type="button" class="btn btn-danger" data-bs-dismiss="modal" onClick={() => deleteCurrentUser(user)}>Yes, Delete !</button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            </Card.Footer>
                                                        </div>
                                                    }
                                                </div>
                                            </Card>
                                        </div>
                                    </Col>
                                )
                            })

                            }
                        </CardGroup >
                    </div >
            }

            {Constants.TOAST_CONTAINER}

        </div >
    )
}

export default UsersData