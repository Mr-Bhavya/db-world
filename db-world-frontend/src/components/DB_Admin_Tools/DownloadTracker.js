import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "./css/DownloadTracker.css";
import CommonServices from '../CommonServices';
import axios from 'axios';

function DownloadTracker() {
  const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
  const navigate = useNavigate();
  const ws = useRef(null);
  var tempStatus;

  useEffect(() => {
    // For local testing, using a hard-coded URL; otherwise use WEBSOCKET_BASEURL.
    ws.current = new WebSocket(`${WEBSOCKET_BASEURL}/api/utils/download-tracker`);
    // ws.current = new WebSocket(`ws://localhost:9000/api/utils/download-tracker`);
    ws.current.onopen = () => {
      console.log("WebSocket connection open for status");
      ws.current.send("");
    };
    ws.current.onmessage = (event) => {
      // Parse the JSON and extract the data object
      tempStatus = Object.values(JSON.parse(event.data)?.data);
      // Add a timestamp for UI updates
      setDownloads(tempStatus.map(element => {
        element["lastUpdated"] = new Date().toISOString();
        return element;
      }));
    };
    ws.current.onclose = () => {
      console.log("WebSocket connection closed for status");
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const [downloads, setDownloads] = useState([]);

  // Fetch download status from the backend
  const fetchDownloadStatus = async () => {
    try {
      const response = await axios.get("/api/admin/status/download");
      // response.data should follow the JSON structure given by the backend
      const { data } = response.data; 
      const downloadsArr = Object.values(data);
      setDownloads(downloadsArr);
    } catch (error) {
      console.error("Error fetching download status:", error);
    }
  };

  // Group downloads by userId
  const groupDownloadsByUser = (downloads) => {
    return downloads.reduce((grouped, download) => {
      const { userId } = download;
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push(download);
      return grouped;
    }, {});
  };

  // Render download cards for a user
  const renderDownloadCards = (userDownloads) => {
    return userDownloads.map((download, index) => {
      // Use uniqueBytesDownloaded for progress calculations
      const progress = (download.uniqueBytesDownloaded / download.fileSize) * 100;
      const fileSize = `${CommonServices.bytesToReadbleFormat(download.fileSize).value} ${CommonServices.bytesToReadbleFormat(download.fileSize).suffix}`;
      const downloadedSize = `${CommonServices.bytesToReadbleFormat(download.uniqueBytesDownloaded).value} ${CommonServices.bytesToReadbleFormat(download.uniqueBytesDownloaded).suffix}`;

      return (
        <div key={index} className="card download-card mb-3">
          <div className="card-header text-black">
            <strong>{download.fileName}</strong>
          </div>
          <div className="card-body">
            <div className="file-info">
              <div className="row">
                <div className="col-md-6">
                  <p>
                    <strong>File Size:</strong> {fileSize}
                  </p>
                  <p>
                    <strong>Downloaded:</strong> {downloadedSize}
                  </p>
                </div>
              </div>
            </div>

            <div className="progress">
              <div
                className="progress-bar progress-bar-striped bg-success"
                role="progressbar"
                style={{ width: `${progress}%` }}
                aria-valuenow={progress}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                {progress.toFixed(1)}%
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <span
                  className={`status-badge ${
                    download.completed
                      ? "bg-success"
                      : download.failed
                      ? "bg-danger"
                      : download.paused
                      ? "bg-secondary"
                      : "bg-warning"
                  }`}
                >
                  {download.completed
                    ? "Completed"
                    : download.failed
                    ? "Failed"
                    : download.paused
                    ? "Paused"
                    : "In Progress"}
                </span>
              </div>
              <div className="col-md-4 text-center p-1">
                <span className="text-muted">
                  {downloadedSize} / {fileSize}
                </span>
              </div>
              <div className="col-md-4 text-end">
                <span className="text-muted">
                  Last updated: {new Date(download.lastUpdated).toLocaleString()}
                </span>
              </div>
            </div>

            {download.failed && (
              <div className="mt-3 alert alert-danger">
                <strong>Error:</strong> {download.error}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  // Group downloads by user and render them
  const groupedDownloads = groupDownloadsByUser(downloads);
  return (
    <div className="container mt-5">
      {(!downloads || downloads.length === 0) && (
        <div className="my-5 alert alert-warning text-center">
          No Downloads Found
        </div>
      )}
      {Object.keys(groupedDownloads).map((userId) => (
        <div key={userId} className="mb-5">
          <h3>User: {userId}</h3>
          {renderDownloadCards(groupedDownloads[userId])}
        </div>
      ))}
    </div>
  );
}

export default DownloadTracker;
