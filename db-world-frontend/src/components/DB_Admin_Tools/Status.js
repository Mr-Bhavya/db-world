import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Constants from '../Constants';
import { cancelledMirror, deleteMirror } from '../ApiServices';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PauseCircle as PauseCircleIcon,
  Archive as ArchiveIcon,
  Block as BlockIcon, SignalCellularAlt
} from '@mui/icons-material';
import StatusCard from './StatusCard';
import { toast } from '../Toast';

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
  const [connectionStatus, setConnectionStatus] = useState('connecting...');
  const navigate = useNavigate();
  const location = useLocation();
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const connectWebSocket = useCallback(() => {

    const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_BASEURL
      ? `${process.env.REACT_APP_WEBSOCKET_BASEURL}/ws/status`
      : 'ws://localhost:9000/ws/status';
      
    ws.current = new WebSocket(WEBSOCKET_URL);

    ws.current.onopen = () => {
      setConnectionStatus('connected');
      ws.current.send('');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(prevStatus => {
          return data.map(newItem => {
            const existingItem = prevStatus.find(item => item.id === newItem.id);
            return existingItem ? { ...existingItem, ...newItem } : newItem;
          });
        });
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.current.onerror = (error) => {
      setConnectionStatus('falied');
      ws.current.close();
    };

    ws.current.onclose = () => {
      setConnectionStatus('disconnected');
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          connectWebSocket();
          reconnectTimeout.current = null;
        }, 5000);
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connectWebSocket]);

  const openSourceUrl = (url) => {
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Source URL not available");
    }
  };

  const deleteStatus = async (id) => {
    try {
      const deleteRes = await deleteMirror(id);
      if (deleteRes.httpStatusCode === 200) {
        toast.success(deleteRes.message);
        // Optimistically remove the item from state
        setStatus(prev => prev.filter(item => item.id !== id));
      } else if (deleteRes.httpStatusCode === 401) {
        toast.error(deleteRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000,
        });
      } else {
        toast.error(deleteRes.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete status.");
    }
  };

  const cancelTask = async (statusId) => {
    try {
      const cancelRes = await cancelledMirror(statusId);
      if (cancelRes.httpStatusCode === 200) {
        toast.success(cancelRes.message);
        // Optimistically update the status
        setStatus(prev => prev.map(item =>
          item.id === statusId ? { ...item, cancelled: true, currentStatus: 'Cancelled' } : item
        ));
      } else if (cancelRes.httpStatusCode === 401) {
        toast.error(cancelRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000,
        });
      } else {
        toast.error(cancelRes.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel task.");
    }
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
            {status.map((download => (
              <StatusCard download={download} />
            )))}
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

    </div>
  );
}

export default Status;