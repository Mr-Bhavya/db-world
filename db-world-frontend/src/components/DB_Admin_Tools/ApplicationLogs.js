import React, { useEffect, useRef, useState } from 'react';
import Constants from '../Constants';

const ApplicationLogs = () => {

  const [logs, setLogs] = useState([]);
  const [loder, setLoder] = useState(true);
  const ws = useRef(null);
  var tempLogs;

  useEffect(() => {
      ws.current = new WebSocket("/api/utils/logs")
      ws.current.onopen = () => {
          console.log("websocket Connection open for application logs")
          ws.current.send("");
      };
      ws.current.onmessage = (event) => {
          tempLogs = JSON.parse(event.data);
          setLogs(tempLogs.data);
          setLoder(false);
      }
      ws.current.onclose = () => {
          console.log("websocket connection close for application logs")
      }

      return () => {
          if (ws.current) {
              ws.current.close();
          }
      };
  }, []);

  return (
    <div>
      {
        loder && Constants.LOADER
        ||
        <div>
          <div className='border border-dark rounded m-1' style={{ height: "80vh", overflowX: "auto" }}>
            <p className='m-1' style={{ display: "flex", flexWrap: "nowrap", height: "100%", width: "150%", whiteSpace: "pre" }}
            >
              {logs.length && logs.length > 0 ? logs.reverse().map(element => element).join("\n") : "No log found."}
            </p>
          </div>
        </div>
      }
    </div>
  )

}

export default ApplicationLogs;