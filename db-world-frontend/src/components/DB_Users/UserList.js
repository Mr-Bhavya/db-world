import React, { useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import BtnCellRenderer from './BtnCellRenderer.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Constants from '../Constants.js';
import AG_GRID_MODEL from './AG_GRID_MODEL.js';
import { useDispatch, useSelector } from 'react-redux';
import { deleteUser, findAllUsersService, getAllUsers } from '../ApiServices.js';
import { findAllUsers } from '../../redux/action/allActions.js';

const UserList = () => {

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [gridApi, setGridApi] = useState();
  const [gridColumnApi, setGridColumnApi] = useState();
  const [userId, setUserId] = useState("");
  const userData = useSelector(state => state.userReducer.users);
  var keys;

  const onBtnClicked = async (event, cellData) => {
    if (event === 'delete') {
      let deleteUserRes = await deleteUser(cellData.data.userId);
      if (deleteUserRes.httpStatusCode === 200) {
        toast.success("User Deleted");
        dispatch(findAllUsers(userData.filter(user => user.userId != cellData.data.userId)));
      } else if (deleteUserRes.httpStatusCode === 401) {
        // 
      } else {
        toast.error(deleteUserRes?.message || deleteUserRes?.error);
      }
    }
  }

  const setAgGridData = (data) => {
    setRowData(data.map((row, index) => {
      return {
        ...row,
        ["no"]: index + 1
      }
    }))

    setColumnDefs(AG_GRID_MODEL.columnDefs.map(column => {
      if (column.field === "action") {
        return {
          ...column,
          filter: true,
          resizable: true,
          cellRenderer: BtnCellRenderer,
          groupDisplayType: 'multipleColumns',
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
  }

  const onGridReady = (params) => {
    setGridApi(params.api);
    setGridColumnApi(params.columnApi);
    setAgGridData(userData);
  };

  useEffect(() => {
    setAgGridData(userData);
  }, [userData])


  return (
    <div className='my-3'>
      <div className="ag-theme-alpine" id="myGrid" style={{ height: '70vh' }} >
        <AgGridReact
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          rowData={rowData}
        />
      </div>
      {Constants.TOAST_CONTAINER}
    </div>
  );
}

export default UserList;