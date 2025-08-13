import { Loop } from '@mui/icons-material';
import React, { useEffect, useRef, useState } from 'react';

const ApplicationLogs = ({logs}) => {
  const WEBSOCKET_BASEURL = process.env.REACT_APP_WEBSOCKET_BASEURL;
  // const [logs, setLogs] = useState([]);
  const [loader, setLoader] = useState(false);
  const ws = useRef(null);

  // useEffect(() => {
  //   ws.current = new WebSocket(`${WEBSOCKET_BASEURL}/api/utils/logs`);

  //   ws.current.onopen = () => {
  //     console.log("WebSocket Connection open for application logs");
  //     ws.current.send("");
  //   };

  //   ws.current.onmessage = (event) => {
  //     const tempLogs = JSON.parse(event.data);
  //     setLogs(tempLogs.data);
  //     setLoader(false);
  //   };

  //   ws.current.onclose = () => {
  //     console.log("WebSocket connection closed for application logs");
  //   };

  //   return () => {
  //     if (ws.current) {
  //       ws.current.close();
  //     }
  //   };
  // }, []);

  // Function to determine log color
  const getLogStyle = (log) => {
    if (log.includes("ERROR")) return { color: "red", fontWeight: "bold" };
    if (log.includes("WARN")) return { color: "orange", fontWeight: "bold" };
    if (log.includes("INFO")) return { color: "blue", fontWeight: "bold" };
    return { color: "black" };
  };

  // Function to format logs for better readability
  const formatLog = (log) => {
    const dateMatch = log.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Extracts ISO date if present
    const dateStr = dateMatch ? new Date(dateMatch[0]).toLocaleString() : "";
    const message = log.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, "").trim();

    return (
      <div key={log} style={getLogStyle(log)}>
        {dateStr && <span style={{ color: "gray", fontWeight: "bold" }}>[{dateStr}] </span>}
        {message}
      </div>
    );
  };

  return (
    <div className="container-fluid">
      {/* Loader */}
      {loader && (
        <div className="text-center my-4">
          <Loop animation="border" variant="danger" />
        </div>
      )}

      {/* Logs Display */}
      {!loader && (
        <div 
          className="border border-light rounded-3 bg-light p-2"
          style={{ height: "80vh", overflowY: "auto", maxWidth: "100%", wordBreak: "break-word" }}
        >
          <pre className="m-0 p-2" style={{ whiteSpace: "pre-wrap", fontFamily: "'Courier New', monospace", fontSize: "14px", fontWeight:"bold" }}>
            {logs.length > 0 ? logs.reverse().map(formatLog) : "No log found."}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ApplicationLogs;