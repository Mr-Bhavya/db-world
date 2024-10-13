import React, { useEffect, useState } from 'react';
import { CapacitorHttp, Plugins } from '@capacitor/core';
import CommonServices from '../../CommonServices';
import { Directory, Filesystem } from '@capacitor/filesystem';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { getDownloadStatus, updateDownloadStatus } from '../../../redux/action/allActions';
import Constants from '../../Constants';
import { toast } from 'react-toastify';

const { NotificationPlugin } = { Plugins }; // Assuming you created a custom plugin for notifications

const DownloadFileAndroid = ({ file }) => {
  const [downloadLoder, setDownloadLoader] = useState(false);
  const dispatch = useDispatch();
  var currentFileStatus = useSelector(state => state.downloadProgressReducer);

  const setDownloadStatusInLocal = (file, progress) => {
    console.log("In setDownloadStatusInLocal")
    let downloadFileStatus = JSON.parse(localStorage.getItem("downloadFileStatus"));
    downloadFileStatus[file.fileId] = { file, progress };
    dispatch(updateDownloadStatus(downloadFileStatus));
    setDownloadLoader(false);
  }

  const downloadFile = async () => {
    setDownloadLoader(true);
    const url = file.downloadUrl.replace("https://localhost", "https://db-world.in");
    const fileSize = file.fileSize;
    const chunkSize = 1024 * 1024 * 10;

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

    // let downloadedBytes = 0;F
    // let fileChunks = [];

    // // 2. Download the file in chunks
    // while (downloadedBytes < fileSize) {
    //   const endRange = Math.min(downloadedBytes + chunkSize, fileSize - 1);
    //   console.log(`Downloading bytes: ${downloadedBytes}-${endRange}`);

    //   // 3. Send a Range request for the chunk
    //   const chunkResponse = await axios({
    //     method: 'GET',
    //     url: url,
    //     responseType: 'blob',
    //     progress: true,
    //     timeout: 0,
    //     headers: {
    //       Range: `bytes=${downloadedBytes}-${endRange}`,
    //     },
    //     responseType: 'blob', // Download the chunk as a blob
    //     onDownloadProgress: (progressEvent) => {
    //       setDownloadStatusInLocal({
    //         "loaded": progressEvent.loaded,
    //         "total": file.fileSize,
    //         "pending": file.fileSize - progressEvent.loaded,
    //         "percentage": progressEvent.progress,
    //         "estimated": progressEvent.estimated,
    //         "download": progressEvent.download,
    //         "rate": progressEvent.rate
    //       })
    //       const percentComplete = Math.round(
    //         (progressEvent.loaded / fileSize) * 100
    //       );
    //       setDownloadProgress(percentComplete);
    //     },
    //   });

    //   fileChunks.push(chunkResponse.data); // Store the chunk
    //   downloadedBytes = endRange + 1;
    // }
    // // 4. Merge the chunks into a single Blob
    // const fullFileBlob = new Blob(fileChunks);

    // // 5. Convert the Blob to base64 and save it using Capacitor Filesystem
    // const reader = new FileReader();
    // reader.onloadend = async () => {
    //   const base64Data = reader.result.split(',')[1];

    //   // 6. Save the file using the Capacitor Filesystem API
    //   await Filesystem.writeFile({
    //     path: file.fileName, // Provide the desired file name
    //     data: base64Data,
    //     directory: Directory.Documents, // Store in the Documents directory
    //   });

    //   console.log('File downloaded and saved successfully!');
    // };
    // reader.readAsDataURL(fullFileBlob); // Convert Blob to base64
  };

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
