import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../Constants';
import { cancelledMirror, deleteMirror } from '../ApiServices';
import { Badge, Button, Card, OverlayTrigger, ProgressBar, Tooltip } from 'react-bootstrap';
import CommonServices from '../CommonServices';
import { motion, AnimatePresence } from 'framer-motion';
import { ReconnectingWebSocket } from '../Utils/ReconnectingWebSocket';
import { SignalCellularAlt } from '@mui/icons-material';

// Animation variants with enhanced effects
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
      when: "beforeChildren",
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  },
  hover: {
    y: -2,
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
    transition: { duration: 0.2 }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const statItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 }
  }
};

function Status() {
  const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
  const [status, setStatus] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = 5000;

  // ... (keep all your existing methods like connectWebSocket, deleteStatus, etc.)

  const connectWebSocket = () => {
    setConnectionStatus('connecting');

    ws.current = new ReconnectingWebSocket(`${WEBSOCKET_BASEURL}/api/utils/status`);
    
    ws.current.onopen = () => {
      console.log("WebSocket connection open for status");
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      ws.current.send("");
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(prevStatus => {
          // Merge updates with existing status to maintain references when possible
          return data.map(newItem => {
            const existingItem = prevStatus.find(item => item.id === newItem.id);
            return existingItem ? { ...existingItem, ...newItem } : newItem;
          });
        });
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket connection closed for status", event);
      setConnectionStatus('disconnected');

      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(reconnectInterval * (reconnectAttempts.current + 1), 30000);
        console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);

        setTimeout(() => {
          reconnectAttempts.current += 1;
          connectWebSocket();
        }, delay);
      } else {
        console.log("Max reconnection attempts reached");
        setConnectionStatus('failed');
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus('error');
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [WEBSOCKET_BASEURL]);

  const openSourceUrl = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      Constants.showToast.error("Source URL not available");
    }
  };

  const getStatusBadgeVariant = (download) => {
    if (download.completed) return 'success';
    if (download.failed) return 'danger';
    if (download.cancelled) return 'secondary';
    if (download.pause) return 'warning';
    return 'primary';
  };

  const deleteStatus = async (id) => {
    try {
      const deleteRes = await deleteMirror(id);
      if (deleteRes.httpStatusCode === 200) {
        Constants.showToast.success(deleteRes.message);
        // Optimistically remove the item from state
        setStatus(prev => prev.filter(item => item.id !== id));
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
      Constants.showToast.error("Failed to delete status.");
    }
  };

  const cancelTask = async (statusId) => {
    try {
      const cancelRes = await cancelledMirror(statusId);
      if (cancelRes.httpStatusCode === 200) {
        Constants.showToast.success(cancelRes.message);
        // Optimistically update the status
        setStatus(prev => prev.map(item =>
          item.id === statusId ? { ...item, cancelled: true, currentStatus: 'Cancelled' } : item
        ));
      } else if (cancelRes.httpStatusCode === 401) {
        Constants.showToast.error(cancelRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000,
        });
      } else {
        Constants.showToast.error(cancelRes.message);
      }
    } catch (err) {
      console.error(err);
      Constants.showToast.error("Failed to cancel task.");
    }
  };

  const getProgressVariant = (download) => {
    if (download.completed) return 'success';
    if (download.failed) return 'danger';
    if (download.cancelled) return 'secondary';
    if (download.pause) return 'warning';
    return 'primary';
  };

  const renderDownloadCard = (download) => {
    const progress = download?.downloadStatus?.totalFileSize > 0
      ? (download?.downloadStatus?.fileDownloaded / download?.downloadStatus?.totalFileSize) * 100
      : 0;

    const speedData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.speed || 0);
    const speed = `${speedData.value}${speedData.suffix}/s`;

    const downloadedData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.fileDownloaded || 0);
    const downloaded = `${downloadedData.value} ${downloadedData.suffix}`;

    const totalSizeData = CommonServices.bytesToReadbleFormat(download?.downloadStatus?.totalFileSize || 0);
    const totalSize = `${totalSizeData.value} ${totalSizeData.suffix}`;

    const eta = CommonServices.formatETA(download?.downloadStatus?.eta);

    return (
      <motion.div
        key={download.id}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover="hover"
        layout
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '1rem'
        }}
      >
        <Card
          className="download-card"
          style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            background: 'linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(245,245,245,0.9))',
            backdropFilter: 'blur(5px)'
          }}
        >
          <Card.Header
            className="download-header"
            style={{
              background: 'linear-gradient(to right, #f8f9fa, #e9ecef)',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              padding: '1rem 1.5rem'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                  gap: '0.5rem'
                }}
              >
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>{download.fileName}</Tooltip>}
                >
                  <h5
                    className="file-name"
                    style={{
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 500,
                      fontSize: '1.1rem',
                      color: '#333'
                    }}
                  >
                    {download.fileName}
                  </h5>
                </OverlayTrigger>

                {download.fileUrl && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button
                      variant="link"
                      className="text-info p-1"
                      onClick={() => openSourceUrl(download.fileUrl)}
                      aria-label="Open source URL"
                      style={{ padding: '0.25rem' }}
                    >
                      <i className="fas fa-external-link-alt" style={{ fontSize: '0.875rem' }}></i>
                    </Button>
                    <Button
                      variant="link"
                      className="text-secondary p-1"
                      onClick={() => CommonServices.handleCopy(download.fileUrl)}
                      aria-label="Copy URL to clipboard"
                      style={{ padding: '0.25rem' }}
                    >
                      <i className="far fa-copy" style={{ fontSize: '0.875rem' }}></i>
                    </Button>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Badge
                  pill
                  bg={getStatusBadgeVariant(download)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35em 0.65em',
                    fontWeight: 500,
                    letterSpacing: '0.5px'
                  }}
                >
                  {download.currentStatus}
                </Badge>

                {(download.completed || download.failed) && (
                  <Button
                    variant="link"
                    className="text-danger p-1"
                    onClick={() => deleteStatus(download.id)}
                    aria-label="Delete download"
                    style={{ padding: '0.25rem' }}
                  >
                    <i className="far fa-trash-alt" style={{ fontSize: '0.875rem' }}></i>
                  </Button>
                )}

                {(!download.completed && !download.failed && !download.cancelled) && (
                  <>
                    <Button
                      variant="link"
                      className="text-warning p-1"
                      onClick={() => console.log("Pause task", download.id)}
                      aria-label="Pause download"
                      style={{ padding: '0.25rem' }}
                    >
                      <i className="fas fa-pause" style={{ fontSize: '0.875rem' }}></i>
                    </Button>
                    <Button
                      variant="link"
                      className="text-danger p-1"
                      onClick={() => cancelTask(download.id)}
                      aria-label="Cancel download"
                      style={{ padding: '0.25rem' }}
                    >
                      <i className="fas fa-times-circle" style={{ fontSize: '0.875rem' }}></i>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card.Header>

          <Card.Body style={{ padding: '1.5rem' }}>
            <motion.div
              initial={{ scaleX: 0.8, opacity: 0.8 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <ProgressBar
                now={progress}
                label={`${progress.toFixed(1)}%`}
                variant={getProgressVariant(download)}
                style={{
                  height: '15px',
                  borderRadius: '4px',
                  marginBottom: '1.5rem',
                  overflow: 'hidden'
                }}
                animated={!download.completed && !download.failed && !download.cancelled && !download.pause}
              />
            </motion.div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem'
              }}
            >
              {[
                { label: 'Downloaded', value: downloaded },
                { label: 'Total Size', value: totalSize },
                { label: 'Speed', value: speed },
                { label: 'ETA', value: eta }
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={statItemVariants}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.02)'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6c757d',
                      fontWeight: 500,
                      marginBottom: '0.25rem'
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 500,
                      color: '#343a40'
                    }}
                  >
                    {stat.value}
                  </div>
                </motion.div>
              ))}
            </div>

            {download.failed && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{
                  opacity: 1,
                  height: 'auto',
                  marginTop: '1rem'
                }}
                transition={{ duration: 0.3 }}
                style={{
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  background: 'rgba(220,53,69,0.1)',
                  borderLeft: '3px solid #dc3545'
                }}
              >
                <strong style={{ color: '#dc3545' }}>Error:</strong> {download.message}
              </motion.div>
            )}

            {download.message && !download.failed && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{
                  opacity: 1,
                  height: 'auto',
                  marginTop: '1rem'
                }}
                transition={{ duration: 0.3 }}
                style={{
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  background: 'rgba(13,110,253,0.1)',
                  borderLeft: '3px solid #0d6efd'
                }}
              >
                <strong style={{ color: '#0d6efd' }}>Message:</strong> {download.message}
              </motion.div>
            )}
          </Card.Body>
        </Card>
      </motion.div>
    );
  };

  return (
    <div
      className="download-container"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        // padding: '2rem 1rem'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'rgba(0,0,0,0.02)',
          border: '1px solid rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ fontWeight: 1000, color: '#495057' }}>
          Download Manager
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <small
            style={{
              color: connectionStatus === 'connected' ? '#28a745' :
                connectionStatus === 'connecting' ? '#ffc107' : '#dc3545',
              fontWeight: 800
            }}
          >
            <SignalCellularAlt sx={{ mr: 1 }} />
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </small>
        </div>
      </motion.div>

      {(!status || status.length === 0) ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            padding: '2rem',
            textAlign: 'center',
            borderRadius: '8px',
            background: 'rgba(255,193,7,0.1)',
            border: '1px dashed #ffc107',
            margin: '2rem 0'
          }}
        >
          <i
            className="far fa-cloud-download-alt"
            style={{
              fontSize: '2rem',
              color: '#ffc107',
              marginBottom: '1rem',
              display: 'block'
            }}
          ></i>
          <div style={{ color: '#6c757d', fontWeight: 500 }}>
            No active downloads
          </div>
          <small style={{ color: '#adb5bd' }}>
            Start a new download to see it appear here
          </small>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start'
          }}
        >
          <AnimatePresence>
            {status.map(renderDownloadCard)}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Inline CSS for animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .download-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        
        .progress-bar {
          transition: width 0.6s ease;
        }
      `}</style>
      {Constants.TOAST_CONTAINER}
    </div>
  );
}

export default Status;