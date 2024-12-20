import React, { useEffect, useState } from 'react';
// import { CapacitorHttp, Plugins } from '@capacitor/core';
import CommonServices from '../../CommonServices';
import { Directory, Filesystem } from '@capacitor/filesystem';
// import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { getDownloadStatus, updateDownloadStatus } from '../../../redux/action/allActions';
import Constants from '../../Constants';
import { toast } from 'react-toastify';

// const { NotificationPlugin } = { Plugins }; // Assuming you created a custom plugin for notifications

const DownloadFileAndroid = ({ file }) => {
  const [downloadLoder, setDownloadLoader] = useState(false);
  const dispatch = useDispatch();
  var currentFileStatus = useSelector(state => state.downloadProgressReducer);

  const setDownloadStatusInLocal = (file, progress) => {
    let downloadFileStatus = JSON.parse(localStorage.getItem("downloadFileStatus"));
    downloadFileStatus[file.fileId] = { file, progress };
    dispatch(updateDownloadStatus(downloadFileStatus));
    setDownloadLoader(false);
  }

  const downloadFile = async () => {
    setDownloadLoader(true);
    const url = file.downloadUrl
    try {
      await Filesystem.deleteFile({
        directory: Directory.Documents,
        path: file.fileName
      });
    } catch (deleteFileException) {
      console.log(deleteFileException);
    }


    try {
      let progressListener = await Filesystem.addListener("progress", (progressEvent) =>
        setDownloadStatusInLocal(file, {
          "loaded": typeof (progressEvent.bytes) == "number" ? (progressEvent.bytes > 0 ? progressEvent.bytes : progressEvent.bytes * (-1)) : currentFileStatus?.progress?.loaded,
          "total": file.fileSize,
          "pending": file.fileSize - progressEvent.bytes,
          "download": true,
          "failed": false,
          "message": null
        })
      );

      toast.success("Download Start for file:",file.fileName)

      let downloadRes = await Filesystem.downloadFile({
        url, path: file.fileName, directory: Directory.Documents,
        method: "GET", progress: true, responseType: "blob",
        recursive: true
      });

        setDownloadStatusInLocal({
          "loaded": file.fileSize,
          "total": file.fileSize,
          "pending": 0,
          "download": false,
          "failed": false,
          "message": null
        })

      // console.log("Download complete.")
      await progressListener.remove();
      toast.success("Download Complete for file:",file.fileName)
    } catch (ex) {
      console.log(ex);
      toast.error(ex?.message);
      setDownloadStatusInLocal({
        "loaded": file.fileSize,
        "total": file.fileSize,
        "pending": 0,
        "download": false,
        "failed": true,
        "message": ex
      })
    }
  };

  useEffect(()=>{
    const createUrls = () => {
      let tempUrl = window.location.origin + "/api/stream/watch/" + file.fileId + "?t=" + localStorage.getItem("token");
      if (window.location.port === "3000") {
          tempUrl = tempUrl.replace("3000", "9000")
      }
      file["videoUrl"] = tempUrl;
      tempUrl = tempUrl.replace("/watch", "/download")
      file["downloadUrl"] = tempUrl;
  }
  createUrls();
  }, [])

  useEffect(() => {
    let progress = {
      "download": false,
      "loaded": 0,
      "pending": 0,
      "total": file.fileSize,
      "failed": false
    };

    let downloadFileStatus = localStorage.getItem("downloadFileStatus");
    if (downloadFileStatus == null) {
      downloadFileStatus = {}
      downloadFileStatus[file.fileId] = { file, progress };
      localStorage.setItem("downloadFileStatus", JSON.stringify(downloadFileStatus));
    } else {
      downloadFileStatus = JSON.parse(downloadFileStatus);
      if (Object.keys(downloadFileStatus).filter(key => key == file.fileId).length == 0) {
        downloadFileStatus[file.fileId] = { file, progress };
        localStorage.setItem("downloadFileStatus", JSON.stringify(downloadFileStatus));
      }
      // console.log("In Donwnload file useEffect", currentFileStatus);
    }

  }, [currentFileStatus]);

  return (
    <div>
      {/* {console.log("In DonwloadFile Button, Loded = ", CommonServices.bytesToReadbleFormat(currentFileStatus[file.fileId]?.progress?.loaded))} */}
      {
        currentFileStatus == null || !currentFileStatus[file.fileId]?.progress?.download || currentFileStatus[file.fileId]?.progress?.failed
          ? downloadLoder ?
            <button className="btn btn-danger-sm" type="button" disabled={true}>
              <span className="spinner-border spinner-border" role="status" aria-hidden="true"></span>
              Downloading...
            </button>
            : <button className='btn btn-danger' onClick={downloadFile}>
              Download File</button>
          : <button className='btn btn-danger' disabled={true} >
            Download File ({CommonServices.getPercentage(currentFileStatus[file.fileId]?.progress?.loaded, currentFileStatus[file.fileId]?.progress?.total)} %)
          </button>
      }
      {/* <button className='btn btn-danger' onClick={downloadFile}>Download File</button> */}
      {/* <p>Progress: {CommonServices.getPercentage(
        currentFileStatus?.loaded, currentFileStatus?.total
      )}%</p> */}
      {Constants.TOAST_CONTAINER}
    </div>
  );
};

export default DownloadFileAndroid;
