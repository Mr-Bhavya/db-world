import React, { useEffect, useState } from 'react';
import JSONView from 'react-json-view'
import CommonServices from '../CommonServices';
import Constants from '../Constants';
import { applicationLogsApi } from '../ApiServices';

const ApplicationLogs = () => {

  const [logs, setLogs] = useState([]);
  const [loder, setLoder] = useState(true);

  async function getApplicationLogs() {
    setLoder(true);
    let logsRes = await applicationLogsApi();
    if (logsRes.httpStatusCode === 200) {
      setLogs(logsRes.data);
    }
    else {
      setLogs(logsRes.message);
    }
    setLoder(false);
  }

  useEffect(() => {
    getApplicationLogs();
  }, [])


  return (
    <div>
      {
        loder && Constants.LOADER
        ||
        <div>
          <div className='row my-1'>
            <div className='col-8'></div>
            <div className='col-4 justify-content-end d-flex'>
              <button className='btn btn-primary'
                onClick={getApplicationLogs}
              >Refresh</button>
            </div>
          </div>
          <div className='border border-dark rounded' style={{ height: "80vh", overflowX: "auto" }}>
            <p className='m-1' style={{ display: "flex", flexWrap: "nowrap", height: "100%", width: "150%", whiteSpace: "pre" }}
            >
              {logs.length && logs.length > 0 ? logs.map(element => element).join("\n") : "No log found."}
            </p>
          </div>
        </div>
      }
    </div>
  )

}

export default ApplicationLogs;