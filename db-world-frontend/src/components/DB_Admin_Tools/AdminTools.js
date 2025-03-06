import React, { useEffect, useState } from 'react';
import Status from './Status';
import { useLocation, useNavigate } from 'react-router-dom';
import UserList from '../DB_Users/UserList';
import Constants from '../Constants';
import queryString from 'query-string';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import SystemInfo from './SystemInfo';
import DownloadStuf from './Mirror/Mirror';
import UserRole from './UserManagment/UserRole';
import { useDispatch } from 'react-redux';
import { findAllUsers } from '../../redux/action/allActions';
import { getAllUsers, getUserRole } from '../ApiServices';
import UsersData from './UserManagment/UsersData';
import { Form } from 'react-bootstrap';
import ApplicationLogs from './ApplicationLogs';
import DownloadTracker from './DownloadTracker';
import StatusCopy from './Status';
import RecordsManagement from './RecordsManagment/RecordsManagement';
import FileExplorer from './FileExplorer/FileExplorer';

function AdminTools() {

    const dispatch = useDispatch();
    const [loader, setLoader] = useState(true);
    const [mainLoader, setMainLoader] = useState(true)
    const [userData, setUserData] = useState({});
    const location = useLocation();
    const navigate = useNavigate();
    const [key, setKey] = useState('download');
    const [userRole, setUserRole] = useState();
    const [tableView, setTableView] = useState(false);

    const tabActiveClassName = 'nav-pills btn-sm bg-dark text-white rounded-3 m-2 text-sm-center text-nowrap'
    const tabClassName = 'nav-pills btn-sm bg-white border-1 border-dark rounded-3 text-dark m-2 text-nowrap'

    const navigateToLogin = async () => {
        navigate(Constants.LOGIN_ROUTE, {state: {from: location}});
    }

    const setHasKey = () => {
        if (location.hash.length !== 0) {
            let hash = queryString.parse(location.hash);
            setKey(hash.active)
        }
        setLoader(false);
    }

    const fetchAllUser = async () => {

        let usersRes = await getAllUsers();
        if (usersRes.httpStatusCode === 200) {
            dispatch(findAllUsers(usersRes.data))
        } else if (usersRes.httpStatusCode === 401) {
            await navigateToLogin();
        } else if (usersRes.httpStatusCode === 403) {
            alert("You don't have admin rights.")
            navigate(Constants.DB_WORLD_HOME_ROUTE, { replace: true });
        }
        setHasKey();
        setMainLoader(false);

    }

    useEffect(() => {
        fetchAllUser();
    }, [])

    useEffect(() => {
        setHasKey();
    }, [location])

    return (
        <div className="card m-1" style={{ background: "rgba(255 ,255 ,255, 0.9)" }}>

            {
                mainLoader ? Constants.LOADER :
                    <div>
                        <div className=''>
                            <Tabs
                                defaultActiveKey="Download"
                                id="controlled-tab"
                                className="mb-3 flex-nowrap bg-light"
                                transition={true}
                                // onMouseOut={()=>setLoader(false)}
                                activeKey={key}
                                onSelect={(k) => {
                                    setLoader(true)
                                    navigate(`${Constants.DB_ADMIN_TOOLS_ROUTE}#active=${k}`)
                                }}
                                style={{ overflowX: "auto" }}
                            >
                                <Tab className='m-1'  eventKey="user_data" title="User Details" tabClassName={key === 'user_data' ? tabActiveClassName : tabClassName}>
                                    <Form>
                                        <Form.Switch // prettier-ignore
                                            type="switch"
                                            id="table_view"
                                            label="Table View On/Off"
                                            checked={tableView}
                                            onChange={() => setTableView(!tableView)}
                                        />
                                    </Form>
                                    {loader ? Constants.LOADER : key === 'user_data' && !tableView ? <UsersData /> : <UserList />}
                                </Tab>
                                <Tab className='m-3' eventKey="user_role" title="User_Role" tabClassName={key === 'User Role' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'user_role' && <UserRole userData={userData} />}
                                </Tab>
                                <Tab className='m-3' eventKey="records" title="Records Managment" tabClassName={key === 'records' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'records' && <RecordsManagement userRole={userRole} />}
                                </Tab>
                                <Tab className='m-3' eventKey="download" title="Download" tabClassName={key === 'download' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'download' && <DownloadStuf />}
                                </Tab>
                                <Tab className='m-3' eventKey="status" title="Status" tabClassName={key === 'status' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'status' && <Status />}
                                </Tab>
                                <Tab className='m-3' eventKey="download-tracker" title="Download Tracker" tabClassName={key === 'download-tracker' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'download-tracker' && <DownloadTracker />}
                                </Tab>
                                <Tab className='m-1' eventKey="logs" title="Logs" tabClassName={key === 'logs' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'logs' && <ApplicationLogs userRole={userRole} />}
                                </Tab>
                                <Tab className='m-3' eventKey="file_explorer" title="File Explorer" tabClassName={key === 'file_explorer' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'file_explorer' && <FileExplorer />}
                                </Tab>
                                <Tab className='m-3' eventKey="system" title="System Info" tabClassName={key === 'system' ? tabActiveClassName : tabClassName}>
                                    {loader ? Constants.LOADER : key === 'system' && <SystemInfo />}
                                </Tab>
                            </Tabs>
                        </div>
                    </div>
            }
        </div>
    )

}

export default AdminTools;