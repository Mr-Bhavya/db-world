import React, { useEffect, useState } from "react";
import { ListGroup, ListGroupItem, Spinner } from "react-bootstrap";
import { getStreamMediaList } from "../../ApiServices";
import File from "./File";


function FileList() {

    const [files, setFiles] = useState([]);
    const [requestData, setRequestData] = useState({
        filePath: '', ftp: false
    })
    const [loader, setLoader] = useState(true);

    const getList = async () => {
        setLoader(true);
        let response = await getStreamMediaList(requestData.filePath);
        if (response.httpStatusCode === 200) {
            setFiles(response.data);
        }
        setLoader(false)
    }

    useEffect(() => {
        getList();
    }, [requestData])

    const folder = () => {
        if (files.length > 0) {
            return (
                <div>
                    <ListGroup>
                        <h5> Folder List </h5>
                        {
                            files.map(folder => {
                                return (
                                    folder.isDirectory &&
                                    <ListGroupItem className="overflow-auto mx-3">
                                        <span className="btn" onClick={() => {
                                            setRequestData({ filePath: folder.filePath, ftp: folder.isFTP });
                                        }}>📂 {folder.fileName}</span>
                                        
                                    </ListGroupItem>
                                )
                            })
                        }
                    </ListGroup>
                </div>
            )
        }
    }

    const file = () => {
        if (files.length > 0) {
            return (
                <div>
                    <ListGroup>
                        <h5> Files List </h5>
                        {
                            files.map(file => {
                                return (
                                    file.isFile &&
                                    <ListGroupItem className="overflow-auto mx-3">
                                        <File file={file} />
                                    </ListGroupItem>
                                )
                            })
                        }
                    </ListGroup>
                </div>
            )
        }
    }

    return (
        <div className="m-1 w-100">

            <div>
                <button className="btn btn-dark" onClick={
                    () => {
                        // if (bodyData.filePath !== "D:/Bhavya/Videos" && bodyData.filePath !== "D:/Bhavya/Videos/" && bodyData.filePath !== "F:/Movies" && bodyData.filePath !== "F:/Movies/") {
                        let tempPath = requestData.filePath.split("/").slice(0, -1).join("/");
                        console.log(tempPath);
                        setRequestData({
                            filePath: tempPath,
                            ftp: tempPath === "" || tempPath == null ? false : requestData.ftp
                        })
                        // }
                    }
                }>
                    🔙 Back
                </button>
                <span className="mx-3"><b>Path: </b>{requestData.filePath}</span>
            </div>
            <hr />
            {
                loader ?
                <div className="d-flex justify-content-center" >
                    <Spinner animation="border" variant="danger" />
                </div>
                :
                <div>
                    {folder()}
                    <hr />
                    {file()}
                </div>
            }

        </div>
    )
}

export default FileList;