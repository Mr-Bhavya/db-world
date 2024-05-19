import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles//ag-grid.css';
import 'ag-grid-community/styles//ag-theme-alpine.css';

import BtnCellRenderer from './BtnCellRenderer.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Constants from '../Constants.js';
import AG_GRID_MODEL from './AG_GRID_MODEL.js';
import { useDispatch, useSelector } from 'react-redux';
import { findAllUsersService, getAllUsers } from '../ApiServices.js';

const UserList = () => {

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [gridApi, setGridApi] = useState();
  const [gridColumnApi, setGridColumnApi] = useState();
  const [_id, set_id] = useState("");
  const userData = useSelector(state => state.userReducer.users);
  var keys;

  const deleteUser = async (_id) => {
    let deleteUserRes = await fetch(`${Constants.DELETE_USER_API}?_id=${_id}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json"
      }
    })
    if (deleteUserRes && deleteUserRes.status && deleteUserRes.status == 200) {
      toast.success("User deleted.")
    } else {
      const data = await deleteUserRes.json();
      toast.error(data.errorMessages);
    }
  }

  const onBtnClicked = async (event, cellData) => {
    if (event === 'delete') {
      console.log(cellData.data._id, "is deleted");
      set_id(cellData.data._id);
      await deleteUser(cellData.data._id);
      let response = await getAllUsers();
      dispatch(response.data);
      await setAgGridData(response.data);
    }
  }

  const setAgGridData = async (data) => {
    // keys = Object.keys(data[0]);
    // keys.unshift("no");
    setRowData(data.map((row, index) => {
      return {
        ...row,
        ["no"]: index + 1
      }
    }))
    // setColumnDefs(keys.map((key) => {
    //   return {
    //     field: key,
    //     colId: key,
    //     filter: true,
    //     resizable: true,
    //     width: key === "no" ? 70 : "",
    //     pinned: key === "no" ? "left" : "",
    //   }
    // }))

    setColumnDefs(AG_GRID_MODEL.columnDefs.map(column => {
      if (column.field === "action") {
        return {
          ...column,
          filter: true,
          resizable: true,
          cellRenderer: BtnCellRenderer,
          cellRendererParams: {
            clicked: onBtnClicked,
          },
        }
      } else {
        return {
          ...column,
          filter: true,
          resizable: true,
        }
      }
    }))

    // setColumnDefs(columnDefs => [...columnDefs, {
    //   field: "Action",
    //   headerName: "Action",
    //   minWidth: 150,
    //   cellRenderer: BtnCellRenderer,
    //   cellRendererParams: {
    //     clicked: onBtnClicked,
    //   },
    //   editable: false,
    //   colId: "action"
    // }])
  }

  const onGridReady = async (params) => {
    setGridApi(params.api);
    setGridColumnApi(params.columnApi);
    setAgGridData(userData);
    // await loadList();
    // params.api.sizeColumnsToFit()
    params.columnApi.autoSizeColumns(keys, false)
  };


  return (
    <div className='my-3' style={{ width: '100%',  }}>
      <div
        id="myGrid"
        style={{
          height: '70vh',
          // height: '70vh',
          // width: '80%',
        }}
        className="ag-theme-alpine m-1"
      >
        <AgGridReact
          columnDefs={columnDefs}
          // defaultColDef={this.state.defaultColDef}
          // frameworkComponents={this.state.frameworkComponents}
          onGridReady={onGridReady}
          rowData={rowData}
        />
      </div>
    </div>
  );
}

export default UserList;