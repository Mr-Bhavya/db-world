import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Constants from '../Constants';
import { cancelledMirror, deleteMirror } from '../ApiServices';
import "./css/Status.css";
import { Badge, Button, Card, Col, OverlayTrigger, ProgressBar, Row, Tooltip } from 'react-bootstrap';
import CommonServices from '../CommonServices';

function Status() {
  const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
  const [status, setStatus] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(`${WEBSOCKET_BASEURL}/api/utils/status`);
    // ws.current = new WebSocket(`ws://localhost:9000/api/utils/status`);
    ws.current.onopen = () => {
      console.log("WebSocket connection open for status");
      ws.current.send("");
    };
    ws.current.onmessage = (event) => {
      setStatus(JSON.parse(event.data));
    };
    ws.current.onclose = () => {
      console.log("WebSocket connection closed for status");
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [WEBSOCKET_BASEURL]);

  const deleteStatus = async (id) => {
    try {
      const deleteRes = await deleteMirror(id);
      if (deleteRes.httpStatusCode === 200) {
        Constants.showToast.success(deleteRes.message);
      } else if (deleteRes.httpStatusCode === 401) {
        Constants.showToast.error(deleteRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000,
        });
      } else {
        Constants.showToast.error(deleteRes.message);
      }
    } catch (err) {
      console.error(err);
      Constants.showToast.error("Failed.");
    }
  };

  const cancelleTask = async (statusId) => {
    const cancelleRes = await cancelledMirror(statusId);
    if (cancelleRes.httpStatusCode === 200) {
      Constants.showToast.success(cancelleRes.message);
    } else if (cancelleRes.httpStatusCode === 401) {
      Constants.showToast.error(cancelleRes.message + Constants.RE_LOGIN, {
        onClose: async () => {
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        },
        autoClose: 1000,
      });
    } else {
      Constants.showToast.error(cancelleRes.message);
    }
  };

  // New helper: Open the source URL in a new tab
  const openSourceUrl = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      Constants.showToast.error("Source URL not available");
    }
  };


  return (
    <div className="download-container">
      {(!status || status.length === 0) ? (
        <div className="my-5 alert alert-warning text-center">
          No Downloads Found
        </div>
      ) : (
        status.map((download) => {
          const progress =
            (download?.downloadStatus?.fileDownloaded / download?.downloadStatus?.totalFileSize) * 100;
          const speed = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.speed).value +
            CommonServices.bytesToReadbleFormat(download?.downloadStatus?.speed).suffix + '/s';
          const downloaded = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.fileDownloaded).value +
            " " + CommonServices.bytesToReadbleFormat(download?.downloadStatus?.fileDownloaded).suffix;
          const totalSize = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.totalFileSize).value +
            " " + CommonServices.bytesToReadbleFormat(download?.downloadStatus?.totalFileSize).suffix;
          const eta = CommonServices.formatETA(download?.downloadStatus?.eta);

          console.log(eta, download?.downloadStatus?.eta)
        
          return (
            <Card key={download?.id} className="download-card mb-4">
              <Card.Header className="download-header">
                <Row className="align-items-center">
                  <Col xs={12} md={8}>
                    <OverlayTrigger
                      placement="top"
                      overlay={<Tooltip>{download?.fileName}</Tooltip>}
                    >
                      <h5 className="file-name">{download?.fileName}</h5>
                    </OverlayTrigger>
                    {/* New: Button to open/copy source URL */}
                    {download?.fileUrl && (
                      <Button
                        variant="link"
                        className="text-info ms-2"
                        onClick={() => openSourceUrl(download.fileUrl)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                          className="bi bi-link-45deg" viewBox="0 0 16 16">
                          <path d="M4.715 6.542a3 3 0 0 1 4.243-4.243l1.06 1.06a.5.5 0 0 1-.708.708l-1.06-1.06a2 2 0 1 0-2.828 2.828l1.06 1.06a.5.5 0 1 1-.708.708l-1.06-1.06z"/>
                          <path d="M6.542 4.715a3 3 0 0 1 4.243 4.243l-1.06 1.06a.5.5 0 1 1-.708-.708l1.06-1.06a2 2 0 1 0-2.828-2.828l-1.06 1.06a.5.5 0 0 1-.708-.708l1.06-1.06z"/>
                        </svg>
                      </Button>
                    )}
                  </Col>
                  <Col xs={12} md={4} className="text-md-end mt-2 mt-md-0">
                    <Badge
                      className='status-badge'
                      pill
                      bg={
                        download?.completed ? 'success' :
                          download?.failed ? 'danger' :
                            download?.cancelled ? 'secondary' :
                              download?.pause ? 'warning' : 'primary'
                      }
                    >
                      {download?.currentStatus}
                    </Badge>
                    {/* Show DELETE button on complete or failed */}
                    {(download?.completed || download?.failed) && (
                      <Button
                        variant="link"
                        className="text-danger ms-2"
                        onClick={() => deleteStatus(download?.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                          className="bi bi-trash" viewBox="0 0 16 16">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
                          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z" />
                        </svg>
                      </Button>
                    )}
                    {/* When download is active (not completed, failed, or cancelled), show PAUSE and CANCEL buttons */}
                    {(!download?.completed && !download?.failed && !download?.cancelled) && (
                      <>
                        <Button
                          variant="link"
                          className="text-warning ms-2"
                          onClick={() => console.log("Pause task", download?.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                            className="bi bi-pause-fill" viewBox="0 0 16 16">
                            <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
                          </svg>
                        </Button>
                        <Button
                          variant="link"
                          className="text-danger ms-2"
                          onClick={() => cancelleTask(download?.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                            className="bi bi-x-circle-fill" viewBox="0 0 16 16">
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z" />
                          </svg>
                        </Button>
                      </>
                    )}
                  </Col>
                </Row>
              </Card.Header>

              <Card.Body>
                <ProgressBar
                  now={progress}
                  label={`${progress.toFixed(1)}%`}
                  variant={
                    download?.completed ? 'success' :
                      download?.failed ? 'danger' :
                        download?.cancelled ? 'secondary' :
                          download?.pause ? 'warning' : 'primary'
                  }
                  className="mb-3"
                />

                <Row className="stats-row">
                  <Col xs={6} md={3} className="stat-item">
                    <div className="stat-label">Downloaded</div>
                    <div className="stat-value">{downloaded}</div>
                  </Col>

                  <Col xs={6} md={3} className="stat-item">
                    <div className="stat-label">Total Size</div>
                    <div className="stat-value">{totalSize}</div>
                  </Col>

                  <Col xs={6} md={3} className="stat-item">
                    <div className="stat-label">Speed</div>
                    <div className="stat-value">{speed}</div>
                  </Col>

                  <Col xs={6} md={3} className="stat-item">
                    <div className="stat-label">ETA</div>
                    <div className="stat-value">{eta}</div>
                  </Col>
                </Row>
                {download?.failed && (
                  <div className="mt-3 alert alert-danger">
                    <strong>Error:</strong> {download?.message}
                  </div>
                )}
                {download?.message && !download?.failed && (
                  <div className="mt-3 alert alert-info">
                    <strong>Message:</strong> {download?.message}
                  </div>
                )}
              </Card.Body>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default Status;