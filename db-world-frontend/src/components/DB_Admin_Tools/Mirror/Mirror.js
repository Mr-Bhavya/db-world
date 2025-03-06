import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Youtube_dl from './youtubedl/Youtube_dl';
import { deleteTempFile } from '../../ApiServices';
import Constants from '../../Constants';
import { useLocation, useNavigate } from 'react-router-dom';
import HttpFile from './HttpFile';


function Mirror() {

    const [selectDownloader, setSelectDownloder] = useState("httpFile");
    const [freeMemoryLoder, setFreeMemoryLoder] = useState(false);
    const navigate = useNavigate();
      const location = useLocation();
    let returnStuf;

    if (selectDownloader === "youtube") {
        returnStuf = <Youtube_dl />
    } else if (selectDownloader === "httpFile") {
        returnStuf = <HttpFile />
    }

    const clearTempFiles = async () =>{
        setFreeMemoryLoder(true);
        let res = await deleteTempFile();
        if(res.httpStatusCode === 200){
            toast.success(res.message);
        }else if(res.httpStatusCode === 401 || res.httpStatusCode === 403){
            navigate(Constants.LOGIN_ROUTE, {state: {from: location}});
        }else{
            toast.error(res.message);
        }        
        setFreeMemoryLoder(false);
    }
    
    return (
        <div className="bg-transparent m-1">

            <div class="d-grid d-flex justify-content-end">
                {
                    !freeMemoryLoder ?
                        <button
                            className="btn btn-sm btn-danger float-right" onClick={clearTempFiles}
                        >
                            Clear Temp
                        </button>
                        :
                        <button className="btn btn-sm btn-outline-dark" type="button" disabled>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            &nbsp;&nbsp;&nbsp;Processing ...
                        </button>
                }
            </div>

            <div>
                <div>
                    <select className="form-select form-select-lg my-1"
                        aria-label=".form-select-lg example"
                        onChange={(e) => setSelectDownloder(e.target.value)}
                    >
                        <option selected={selectDownloader === "httpFile" ? true : false} value="httpFile">Http File</option>
                        {/* <option selected={selectDownloader === "clone" ? true : false} value="clone">Clone</option> */}
                        <option selected={selectDownloader === "youtube" ? true : false} value="youtube">Youtube</option>
                    </select>
                </div>
                {returnStuf}
            </div>
            {Constants.TOAST_CONTAINER}
        </div>
    )

}

export default Mirror;