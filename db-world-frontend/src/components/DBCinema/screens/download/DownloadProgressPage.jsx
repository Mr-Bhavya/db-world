// DownloadProgressPage.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AndroidPlugins from "../../../../android-app-components/AndroidPlugins";
import { toast } from "react-toastify";
import Constants from "../../../Constants";

const STORAGE_KEY = "downloadRecords";

// Helper: sort status priority (lower number means higher priority)
const statusPriority = (status) => {
  switch (status) {
    case "running":
      return 1;
    case "queued":
      return 2;
    case "paused":
      return 3;
    case "completed":
      return 4;
    case "cancelled":
      return 5;
    default:
      return 6;
  }
};

const DownloadProgressPage = () => {
  const [downloads, setDownloads] = useState({});
  const navigate = useNavigate();

  // On mount, load persisted download records (if any)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setDownloads(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored download records", e);
      }
    }
  }, []);

  // Save downloads state to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
  }, [downloads]);

  useEffect(() => {
    // Subscribe to download progress events from the native plugin.
    const unsubscribe = AndroidPlugins.MyDownloadManager.addListener(
      "downloadProgress",
      (data) => {
        // data includes: downloadId, progress, currentBytes, totalBytes, fileName, filePath, status, speed, eta.
        const id = data.downloadId;
        setDownloads((prev) => ({
          ...prev,
          [id]: {
            fileName: data.fileName,
            filePath: data.filePath,
            currentBytes: data.currentBytes,
            totalBytes: data.totalBytes,
            progress: data.progress,
            status: data.status,
            speed: data.speed, // in bytes per second
            eta: data.eta,     // in seconds
          },
        }));
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // UI helper: color based on status
  const getStatusColor = (status) => {
    switch (status) {
      case "running":
        return "#007bff";
      case "queued":
        return "#17a2b8";
      case "paused":
        return "#ffc107";
      case "cancelled":
        return "#dc3545";
      case "completed":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  // Format bytes as human-readable strings.
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Format seconds into a human-readable time.
  const formatTime = (seconds) => {
    seconds = Math.floor(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
  };

  // Handlers for plugin actions.
  const handlePause = async (downloadId) => {
    Constants.showToast.info(
      <>
        <i className="fas fa-pause-circle mr-2" />
        Pausing download...
      </>
    );
    try {
      await AndroidPlugins.MyDownloadManager.pauseDownload({ downloadId });
      setDownloads((prev) => ({
        ...prev,
        [downloadId]: { ...prev[downloadId], status: "paused" },
      }));
      Constants.showToast.success("Download paused (" + downloadId + ")");
    } catch (error) {
      console.error("Error pausing download:", error);
    }
  };

  const handleResume = async (downloadId) => {
    Constants.showToast.info(
      <>
        <i className="fas fa-play-circle mr-2" />
        Resuming download...
      </>
    );
    try {
      await AndroidPlugins.MyDownloadManager.resumeDownload({ downloadId });
      setDownloads((prev) => ({
        ...prev,
        [downloadId]: { ...prev[downloadId], status: "running" },
      }));
      Constants.showToast.success("Download resumed (" + downloadId + ")");
    } catch (error) {
      console.error("Error resuming download:", error);
    }
  };

  const handleCancel = async (downloadId) => {
    try {
      await AndroidPlugins.MyDownloadManager.cancelDownload({ downloadId });
      setDownloads((prev) => ({
        ...prev,
        [downloadId]: { ...prev[downloadId], status: "cancelled" },
      }));
      Constants.showToast.success("Download cancelled (" + downloadId + ")");
    } catch (error) {
      console.error("Error cancelling download:", error);
    }
  };

  // Sort downloads so that running ones are on top.
  const sortedDownloads = Object.entries(downloads).sort(
    (a, b) => statusPriority(a[1].status) - statusPriority(b[1].status)
  );

  return (
    <div
      className="container my-5 p-4"
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
      }}
    >
      {/* Back Button */}
      <div className="d-flex justify-content-start mb-3">
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </div>
      <h2 className="mb-4 text-center">Download Progress</h2>
      {sortedDownloads.length === 0 ? (
        <div className="alert alert-info text-center">
          No active downloads.
        </div>
      ) : (
        sortedDownloads.map(([id, download]) => {
          const {
            progress,
            fileName,
            filePath,
            currentBytes,
            totalBytes,
            status,
            speed,
            eta,
          } = download;
          return (
            <div key={id} className="card mb-4 shadow-sm">
              <div className="card-header" style={{ background: getStatusColor(status), color: "#fff" }}>
                <strong>Download ID:</strong> {id} - {fileName}{" "}
                {status === "queued" && <span>(Queued)</span>}
              </div>
              <div className="card-body">
                <p className="card-text mb-1">
                  <strong>Location:</strong> {filePath}
                </p>
                <p className="card-text mb-1">
                  <strong>Total Size:</strong>{" "}
                  {totalBytes ? formatBytes(totalBytes) : "Unknown"}
                </p>
                <p className="card-text mb-1">
                  <strong>Downloaded:</strong>{" "}
                  {currentBytes ? formatBytes(currentBytes) : "0 Bytes"}
                </p>
                <p className="card-text mb-1">
                  <strong>Speed:</strong>{" "}
                  {speed ? formatBytes(speed) + "/s" : "Calculating..."}
                </p>
                <p className="card-text mb-1">
                  <strong>ETA:</strong> {eta ? formatTime(eta) : "Calculating..."}
                </p>
                <p className="card-text">
                  <strong>Progress:</strong> {progress.toFixed(2)}% -{" "}
                  <strong>Status:</strong> {status}
                </p>
                <div className="progress mb-3" style={{ height: "25px" }}>
                  <div
                    className="progress-bar progress-bar-striped"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: getStatusColor(status),
                      transition: "width 0.5s ease, background-color 0.3s ease",
                    }}
                  >
                    {progress.toFixed(0)}%
                  </div>
                </div>
                <div className="btn-group d-flex justify-content-around" role="group">
                  {status === "running" && (
                    <button onClick={() => handlePause(id)} className="btn btn-warning">
                      Pause
                    </button>
                  )}
                  {status === "paused" && (
                    <button onClick={() => handleResume(id)} className="btn btn-success">
                      Resume
                    </button>
                  )}
                  {status !== "cancelled" && status !== "completed" && (
                    <button onClick={() => handleCancel(id)} className="btn btn-danger">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div className="d-flex justify-content-center mt-4">
        <button className="btn btn-secondary" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
      {Constants.TOAST_CONTAINER}
    </div>
  );
};

export default DownloadProgressPage;