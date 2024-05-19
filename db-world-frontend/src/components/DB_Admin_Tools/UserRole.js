import React, { useEffect, useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import Constants from '../Constants';
import { getAllUserRoles, updateUserRoleService } from '../ApiServices';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const UserRole = ({ userData }) => {

    const users = useSelector(state => state.userReducer.users);
    const [loader, setLoader] = useState(true);
    const [doer_id, setDoer_id] = useState(userData._id);
    const [for_id, setFor_id] = useState(doer_id);
    const [userRole, setUserRole] = useState({});
    const [submitLoader, setSubmitLoader] = useState(false);
    const navigate = useNavigate();
    const [allRoles, setAllRoles] = useState([]);


    const fetchRoles = async () => {
        let allRoleRes = await getAllUserRoles();
        if (allRoleRes.httpStatusCode === 200) {
            setAllRoles(allRoleRes.data)
            if (users && users.length > 1) {
                setLoader(false);
            }
        } else {
            toast.danger("Problem in fetching roles.")
        }
    }

    useEffect(() => {
        fetchRoles();
    }, [users])

    const onSubmit = async () => {
        setSubmitLoader(true);
        let updateRoleRes = await updateUserRoleService(doer_id, for_id, allRoles.filter(role => userRole === role.id).at(0))
        if (updateRoleRes && updateRoleRes.httpStatusCode === 200) {
            toast.success("Role updated.");
        }
        else if (updateRoleRes.httpStatusCode === 401) {
            navigate(Constants.REDIRECT(Constants.ADMIN_USER_ROLE));
        } else {
            toast.error(updateRoleRes.message);
        }
        setSubmitLoader(true);
    }


    return (
        <div className="bg-transparent pb-5">
            {
                loader ? Constants.LOADER :
                    <Card className='m-3' border="dark" style={{ width: '18rem' }}>
                        <Card.Header>Change User Role</Card.Header>
                        <Card.Body>
                            <Card.Title>Select User</Card.Title>
                            <Card.Text>
                                <select className="form-select" aria-label="Default select example" onChange={(e) => setFor_id(e.target.value)} defaultValue={doer_id}>
                                    <option disabled >Open this select menu</option>
                                    {
                                        users.map(user => {
                                            return <option value={user.userId} >
                                                {user.firstName} {user.lastName} | {user.email}
                                            </option>
                                        })
                                    }
                                </select>
                            </Card.Text>
                            <Card.Title>Select Role</Card.Title>
                            <Card.Text>
                                <select className="form-select" aria-label="Default select example" onChange={(e) => setUserRole(e.target.value)}>
                                    <option >Open this select menu</option>
                                    {
                                        allRoles.map(role => {
                                            return (
                                                <option value={role.id} >{role.name}</option>
                                            )
                                        })
                                    }
                                </select>
                            </Card.Text>
                            <Card.Footer>
                                <Button type='button' onClick={onSubmit}>Submit</Button>
                            </Card.Footer>
                        </Card.Body>
                    </Card>

            }
            {Constants.TOAST_CONTAINER}
        </div>
    )
}

export default UserRole;