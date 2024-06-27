import React, { useEffect, useState } from 'react';
import CommonServices from '../CommonServices';
import { systemInfo } from '../ApiServices';
import { toast } from 'react-toastify';
import { Doughnut } from 'react-chartjs-2';
import { Table } from 'react-bootstrap';
import {Chart, ArcElement} from 'chart.js'
Chart.register(ArcElement);

const SystemInfo = () => {

  const [systemData, setSystemData] = useState({});
  const [loder, setLoder] = useState(true);
  const [ram, setRam] = useState();
  const [rom, setRom] = useState();
  const [cpu, setCpu] = useState();

  const createChartData = (label, data) => {
    console.log(data)
    return {
      labels: [
        'Used',
        'Avalabile'
      ],
      datasets: [{
        label: label,
        data: [CommonServices.bytesToReadbleFormat(data.usedSpace).value,
        CommonServices.bytesToReadbleFormat(data.freeSpace).value],
        backgroundColor: [
          CommonServices.getPercentage(data.usedSpace, data.totalSpace) > 75 ? 'red' : 'teal',
          'silver',
          'rgb(255, 205, 86)'
        ],
        hoverOffset: 4
      }]
    }
  }

  const convertObjectToRedable = (sysInfo) => {

    sysInfo.ram.totalSpace = CommonServices.bytesToReadbleFormat(sysInfo?.ram?.totalSpace).value
      + " " + CommonServices.bytesToReadbleFormat(sysInfo?.ram?.totalSpace).suffix;
    sysInfo.ram.freeSpace = CommonServices.bytesToReadbleFormat(sysInfo?.ram?.freeSpace).value
      + " " + CommonServices.bytesToReadbleFormat(sysInfo?.ram?.freeSpace).suffix;
    sysInfo.ram.usedSpace = CommonServices.bytesToReadbleFormat(sysInfo?.ram?.usedSpace).value
      + " " + CommonServices.bytesToReadbleFormat(sysInfo?.ram?.usedSpace).suffix;
    sysInfo.ram.committedVirtualSpace = CommonServices.bytesToReadbleFormat(sysInfo?.ram?.committedVirtualSpace).value
      + " " + CommonServices.bytesToReadbleFormat(sysInfo?.ram?.committedVirtualSpace).suffix;
    sysInfo.ram.freeSwapSpace = CommonServices.bytesToReadbleFormat(sysInfo?.ram?.freeSwapSpace).value
      + " " + CommonServices.bytesToReadbleFormat(sysInfo?.ram?.freeSwapSpace).suffix;

    sysInfo.rom = sysInfo.rom.map(rom => {
      return {
        name: rom.name,
        totalSpace: CommonServices.bytesToReadbleFormat(rom?.totalSpace).value
          + " " + CommonServices.bytesToReadbleFormat(rom?.totalSpace).suffix,
        freeSpace: CommonServices.bytesToReadbleFormat(rom?.freeSpace).value
          + " " + CommonServices.bytesToReadbleFormat(rom?.freeSpace).suffix,
        usedSpace: CommonServices.bytesToReadbleFormat(rom?.usedSpace).value
          + " " + CommonServices.bytesToReadbleFormat(rom?.usedSpace).suffix
      }
    })
    return sysInfo;
  }

  async function getSystemInfo() {
    let infoRes = await systemInfo();
    if (infoRes.httpStatusCode === 200) {
      setRam(infoRes.data.ram);
      setRom(infoRes.data.rom);
      setCpu(infoRes.data.cpu);
      setSystemData(infoRes.data);
    }
    else {
      toast.error(infoRes.message);
    }
    setLoder(false);
  }

  useEffect(() => {
    getSystemInfo();
  }, [])


  return (
    <div className='m-1'>
      {
        loder &&
        <div className="col-md-8">
          <div className='d-flex justify-content-center'>
            <div className="spinner-border text-danger m-5" role="status">
              <span className="sr-only text-center" />
            </div>
          </div>
        </div>
        ||
        <div>
          <div className='row'>

            <div className='card col-sm my-1'>
              <div className='card-title'>
                <h5 className='mt-3 text-center'>Basic Info</h5>
              </div>
              <hr />
              <div className='card-body'>
                <div className='row'>
                  <div className='col-sm'>
                    <Table>
                      <tbody>
                        <tr>
                          <th>Server OS: </th>
                          <td>{systemData.name}</td>
                        </tr>
                        <tr>
                          <th>Arch: </th>
                          <td>{systemData.arch}</td>
                        </tr>
                        <tr>
                          <th>Processer Count: </th>
                          <td>{systemData.cpu.availableProcessors}</td>
                        </tr>
                        <tr>
                          <th>CPU Load: </th>
                          <td>{systemData.cpu.cpuLoad}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            <div className='card col-sm my-1'>
              <div className='card-title'>
                <h5 className='mt-3 text-center'>RAM</h5>
              </div>
              <hr />
              <div className='card-body'>

                <div className='row'>
                  <div className='col-sm'>
                    <Table>
                      <tbody>
                        <tr>
                          <th>Total: </th>
                          <td>{CommonServices.bytesToReadbleFormat(ram.totalSpace).value + " " + CommonServices.bytesToReadbleFormat(ram.totalSpace).suffix}</td>
                          {/* <td rowSpan={5}> <Doughnut data={createChartData("RAM", ram)} /></td> */}
                        </tr>
                        <tr>
                          <th>Avalaible: </th>
                          <td>{CommonServices.bytesToReadbleFormat(ram.freeSpace).value + " " + CommonServices.bytesToReadbleFormat(ram.freeSpace).suffix}</td>
                        </tr>
                        <tr>
                          <th>Used: </th>
                          <td>{CommonServices.bytesToReadbleFormat(ram.usedSpace).value + " " + CommonServices.bytesToReadbleFormat(ram.usedSpace).suffix}</td>
                        </tr>
                        <tr>
                          <th>Virtual: </th>
                          <td>{CommonServices.bytesToReadbleFormat(ram.committedVirtualSpace).value + " " + CommonServices.bytesToReadbleFormat(ram.committedVirtualSpace).suffix}</td>
                        </tr>
                        <tr>
                          <th>Free Swap: </th>
                          <td>{CommonServices.bytesToReadbleFormat(ram.freeSwapSpace).value + " " + CommonServices.bytesToReadbleFormat(ram.freeSwapSpace).suffix}</td>
                        </tr>
                      </tbody>
                    </Table>
                    {/* <Doughnut data={createChartData("RAM", ram)} /> */}
                  </div>
                  <div className='col-sm w-100'>
                    <Doughnut data={createChartData("RAM", ram)} />
                  </div>
                </div>
              </div>
            </div>
          </div>


          <div className='row'>
            <div className='card col-sm-12 my-1'>
              <div className='card-title'>
                <h5 className='mt-3 text-center'>ROM</h5>
              </div>
              <hr />
              <div className='card-body'>
                <div className='row'>
                  {
                    rom.map(tempRom => {
                      return (
                        <div className='card my-1 col-sm'>
                          <div className='card-title'>
                            <h5 className='mt-3 text-center'>Drive - {tempRom.name}</h5>
                          </div>
                          <div className='row'>
                            <div className='col-sm'>
                              <Table>
                                <tbody>
                                  <tr>
                                    <th>Name: </th>
                                    <td>{tempRom.name}</td>
                                  </tr>
                                  <tr>
                                    <th>Total: </th>
                                    <td>{CommonServices.bytesToReadbleFormat(tempRom.totalSpace).value + " " + CommonServices.bytesToReadbleFormat(tempRom.totalSpace).suffix}</td>
                                  </tr>
                                  <tr>
                                    <th>Avalaible: </th>
                                    <td>{CommonServices.bytesToReadbleFormat(tempRom.freeSpace).value + " " + CommonServices.bytesToReadbleFormat(tempRom.freeSpace).suffix}</td>
                                  </tr>
                                  <tr>
                                    <th>Used: </th>
                                    <td>{CommonServices.bytesToReadbleFormat(tempRom.usedSpace).value + " " + CommonServices.bytesToReadbleFormat(tempRom.usedSpace).suffix}</td>
                                  </tr>
                                </tbody>
                              </Table>
                            </div>
                            <div className='col-sm my-3'>
                              <Doughnut data={createChartData(`ROM-${tempRom.name}`, tempRom)} />
                            </div>
                          </div>
                        </div>
                      )
                    })

                  }
                </div>
              </div>
            </div>


          </div>


          {/* <CommonServices.JSONToHTMLTable data={systemData} style={{ overflowX: "auto", width: "100%", display: "block" }} /> */}
        </div>
      }
    </div >
  )

}

export default SystemInfo;