import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Mirror from './Mirror';
import Youtube_dl from './Youtube_dl';
import { deleteTempFile } from '../ApiServices';
import Constants from '../Constants';
import { useNavigate } from 'react-router-dom';


function DownloadStuf() {

    const [selectDownloader, setSelectDownloder] = useState("mirror");
    const [freeMemoryLoder, setFreeMemoryLoder] = useState(false);
    const navigate = useNavigate();
    let returnStuf;

    if (selectDownloader === "youtube") {
        returnStuf = <Youtube_dl />
    } else if (selectDownloader === "mirror") {
        returnStuf = <Mirror />
    }

    const clearTempFiles = async () =>{
        setFreeMemoryLoder(true);
        let res = await deleteTempFile();
        if(res.httpStatusCode === 200){
            toast.success(res.message);
        }else if(res.httpStatusCode === 401 || res.httpStatusCode === 403){
            navigate(await Constants.REDIRECT(Constants.DB_ADMIN_TOOLS_ROUTE + "#active=download" ), { replace: true });
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
                        <option selected={selectDownloader === "mirror" ? true : false} value="mirror">Mirror</option>
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

export default DownloadStuf;