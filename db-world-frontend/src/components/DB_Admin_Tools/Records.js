import React, { useEffect, useState } from 'react';
import { Button, Card } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import Constants from '../Constants';
import { getAllUserRoles, recordsUpdateStatus, updateRecordsWithLatest, updateUserRoleService } from '../ApiServices';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AddRecord from './AddRecord';

const Records = ({ userRole }) => {

    const [selection, setSelection] = useState("add");
    const [status, setStatus] = useState();
    let returnStuf;

    const getRecordUpdateStatus = async () => {
        let statusRes = await recordsUpdateStatus();
        if(statusRes.httpStatusCode === 200){
            // toast.success(statusRes.message);
            if(statusRes.data == null ){
                setStatus(statusRes.message)
            }else{
                let message = `Success: ${statusRes.data.pass} \nFail: ${statusRes.data.fail} \nPending: ${statusRes.data.total - (statusRes.data.pass + statusRes.data.fail)} \nTotal: ${statusRes.data.total}`
                setStatus(message);
            }
        }else if(statusRes.httpStatusCode === 102){
            toast.warning(statusRes.message);
        }else{
            toast.error(statusRes.message);
        }
    }

    const updateRecords = async () => {
        let updateRecRes = await updateRecordsWithLatest();
        if(updateRecRes.httpStatusCode === 200){
            toast.success(updateRecRes.message);
        }else if(updateRecRes.httpStatusCode === 102){
            toast.warning(updateRecRes.message);
        }else{
            toast.error(updateRecRes.message);
        }
    }

    useEffect(() => {
        getRecordUpdateStatus();
    }, [])



    return (
        <div className="bg-transparent pb-5">
            <div>
                <div className='mx-3'>
                    <select className="form-select form-select-lg my-1"
                        aria-label=".form-select-lg example"
                        onChange={(e) => setSelection(e.target.value)}
                    >
                        <option selected={selection === "add" ? true : false} value="add">Add Record</option>
                        <option selected={selection === "update" ? true : false} value="update">Update Records</option>
                    </select>
                </div>
                {
                    selection === "add" && <AddRecord userRole={userRole} />

                }
                {
                    selection === "update" &&
                    <div className='m-3'>
                        <div className='row mx-5'>
                            <button className='btn btn-warning'
                                onClick={updateRecords}
                            >Update Records with latest from TMDB</button>
                        </div>
                        <hr />
                        <div className='my-3'>
                            <div className='row m-1'>
                                <b className='col-6'>Status: </b>
                                <div className='col-6 justify-content-end d-flex'>
                                    <button className='btn btn-primary btn-sm'
                                        onClick={getRecordUpdateStatus}
                                    >Refresh</button>
                                </div>
                            </div>
                            <textarea className='mx-3' value={status} style={{height: "115px", width:"250px"}} />
                        </div>
                    </div>
                }
            </div>
            {Constants.TOAST_CONTAINER}
        </div>
    )
}

export default Records;