import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { FaEdit, FaTrash, FaSync } from 'react-icons/fa';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RecordsManagement.css';
import {
  AddDbCinemaRecord,
  deleteDbCinemaRecord,
  getRecords,
  searchTmdbByQuery,
  UpdateDbCinemaRecord
} from '../../ApiServices';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import DeleteModal from './DeleteModal';
import Constants from '../../Constants';

function RecordsManagement() {
  const navigate = useNavigate();
  const location = useLocation();

  // Table data and loading state
  const [records, setRecords] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  // Form state for add/edit
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [formData, setFormData] = useState({
    recordId: '',
    type: '',
    name: '',
    releaseYear: '',
    tmdb: '',
    showOnTop: false,
    creationDate: '',
    lastModifiedDate: ''
  });

  // TMDB options state (only used in add mode)
  const [tmdbOptions, setTmdbOptions] = useState([]);

  // Button loading states
  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // State for delete modal
  const [deleteModalRecord, setDeleteModalRecord] = useState(null);

  const gridRef = useRef();

  const getAllRecords = async () => {
    setLoadingTable(true);
    const res = await getRecords();
    if (res.httpStatusCode === 200) {
      setRecords(res.data);
    } else {
      toast.error(res.message);
    }
    setLoadingTable(false);
  };

  useEffect(() => {
    getAllRecords();
  }, []);

  // Action Handlers for table
  const handleEdit = (record) => {
    setIsEditing(true);
    setSelectedRecord(record);
    setFormData({
      recordId: record.id,
      type: record.type,
      name: record.name,
      releaseYear: record.releaseYear || '',
      tmdb: record.tmdb ? record.tmdb : '', // TMDB id as string
      showOnTop: record.showOnTop,
      creationDate: record.creationDate ? record.creationDate.substring(0, 16) : '',
      lastModifiedDate: record.lastModifiedDate ? record.lastModifiedDate.substring(0, 16) : ''
    });
  };

  // Open delete confirmation modal
  const openDeleteModal = (record) => {
    setDeleteModalRecord(record);
  };

  // Called when user confirms deletion from the modal
  const handleConfirmDelete = async () => {
    if (deleteModalRecord) {
      try {
        let deleteRes = await deleteDbCinemaRecord(deleteModalRecord.id);
        if (deleteRes.httpStatusCode === 200) {
          toast.success(deleteRes.message);
          handleCloseDeleteModal();
          setRecords(records.filter(record => record.id !== deleteModalRecord.id));
        } else if (deleteRes.httpStatusCode === 401) {
          toast.error(deleteRes.message + Constants.RE_LOGIN);
          navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        } else {
          toast.error(deleteRes.message || deleteRes.errorMessage);
        }
      } catch (err) {
        console.log(err);
        alert(err);
      }
    }
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalRecord(null);
  };

  // Refresh TMDB Handler: marks record as refreshing, simulates API call delay, then resets refreshing flag
  const handleTmdbRefresh = async (record) => {
    setRecords(prevRecords =>
      prevRecords.map(r => r.id === record.id ? { ...r, refreshingTmdb: true } : r)
    );
    try {
      // Simulate API call delay (e.g., 2 seconds)
      let updateRecordRes = await UpdateDbCinemaRecord(record.id, {
        type: record.type,
        name: record.name,
        tmdbId: record.tmdb,
        showOnTop: record.showOnTop
      });
      if (updateRecordRes.httpStatusCode === 200) {
        toast.success("TMDB data refreshed successfully for record " + record.id);
        await getAllRecords();
        resetForm();
      } else if (updateRecordRes.httpStatusCode === 401) {
        toast.error(updateRecordRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000
        });
      } else {
        toast.error(updateRecordRes.message);
      }
    } catch (error) {
      toast.error("Error refreshing TMDB data for record " + record.id);
    } finally {
      setRecords(prevRecords =>
        prevRecords.map(r => r.id === record.id ? { ...r, refreshingTmdb: false } : r)
      );
    }
  };

  // Form Handlers
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const fetchTmdbResults = async () => {
    if (!formData.type || !formData.name) {
      toast.warning('Please fill in both Type and Name fields to search TMDB.');
      return;
    }
    setLoadingTmdb(true);
    let seachTmdbRes = await searchTmdbByQuery(formData.type, formData.name, formData.releaseYear);
    if (seachTmdbRes.httpStatusCode === 200) {
      setTmdbOptions(seachTmdbRes.data);
    } else if (seachTmdbRes.httpStatusCode === 401) {
      navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
    } else {
      toast.error(seachTmdbRes.message);
    }
    setLoadingTmdb(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoadingSubmit(true);
    if (isEditing) {
      // In edit mode, only update name and showOnTop
      let updateRecordRes = await UpdateDbCinemaRecord(formData.recordId, {
        name: formData.name,
        type: formData.type,
        tmdbId: formData.tmdb,
        showOnTop: formData.showOnTop
      });
      if (updateRecordRes.httpStatusCode === 200) {
        toast.success("Record edited successfully.");
        await getAllRecords();
        resetForm();
      } else if (updateRecordRes.httpStatusCode === 401) {
        toast.error(updateRecordRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000
        });
      } else {
        toast.error(updateRecordRes.message);
      }
    } else {
      let addRecordRes = await AddDbCinemaRecord(formData.name, formData.type, formData.tmdb);
      if (addRecordRes.httpStatusCode === 201) {
        toast.success("Record added, RecordId - " + addRecordRes.data.recordId);
        await getAllRecords();
        resetForm();
      } else if (addRecordRes.httpStatusCode === 401) {
        toast.error(addRecordRes.message + Constants.RE_LOGIN, {
          onClose: async () => {
            navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
          },
          autoClose: 1000
        });
      } else {
        toast.error(addRecordRes.message);
      }
    }
    setLoadingSubmit(false);
  };

  const resetForm = () => {
    setIsEditing(false);
    setSelectedRecord(null);
    setFormData({
      recordId: '',
      type: '',
      name: '',
      releaseYear: '',
      tmdb: '',
      showOnTop: false,
      creationDate: '',
      lastModifiedDate: ''
    });
    setTmdbOptions([]);
  };

  // ag‑Grid Column Definitions
  const columnDefs = useMemo(() => [
    { field: 'id', headerName: 'ID', filter: true, sortable: true },
    { field: 'type', headerName: 'Type', filter: true, sortable: true },
    { field: 'name', headerName: 'Name', filter: true, sortable: true },
    {
      field: 'tmdb',
      headerName: 'TMDB',
      filter: true,
      sortable: true,
      valueFormatter: params => params.value ? params.value : ''
    },
    {
      field: 'showOnTop',
      headerName: 'Show On Top',
      filter: true,
      sortable: true,
      valueFormatter: params => params.value ? 'Yes' : 'No'
    },
    {
      field: 'creationDate',
      headerName: 'Creation Date',
      filter: 'agDateColumnFilter',
      sortable: true,
      valueFormatter: params => new Date(params.value).toLocaleString()
    },
    {
      field: 'lastModifiedDate',
      headerName: 'Last Modified Date',
      filter: 'agDateColumnFilter',
      sortable: true,
      valueFormatter: params => new Date(params.value).toLocaleString()
    },
    {
      headerName: 'Actions',
      cellRenderer: params => (
        <div className="rm-action-buttons">
          <button onClick={() => handleEdit(params.data)} title="Edit">
            <FaEdit />
          </button>
          <button onClick={() => openDeleteModal(params.data)} title="Delete">
            <FaTrash />
          </button>
          <button
            onClick={() => handleTmdbRefresh(params.data)}
            disabled={params.data.refreshingTmdb}
            title="Refresh TMDB"
          >
            {params.data.refreshingTmdb ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              <FaSync />
            )}
          </button>
        </div>
      )
    }
  ], [records]);

  // Row class rules to disable a row when refreshing
  const rowClassRules = {
    'refreshing-row': params => params.data.refreshingTmdb === true
  };

  const defaultColDef = {
    flex: 1,
    minWidth: 120,
    filter: true,
    sortable: true,
    resizable: true
  };

  return (
    <div className="records-management">
      <h1>Record Management</h1>

      {/* Form for Adding/Editing a Record */}
      <div className="form-container">
        <form className="record-form" onSubmit={handleFormSubmit}>
          <h2>{isEditing ? 'Edit Record' : 'Add New Record'}</h2>
          {isEditing && (
            <div className="form-group">
              <label>Record ID:</label>
              <input type="text" name="recordId" value={formData.recordId} disabled />
            </div>
          )}
          {/* Type Dropdown */}
          <div className="form-group">
            <label>Type:</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleFormChange}
              required
              disabled={isEditing} // disabled in edit mode
            >
              <option value="">Select Type</option>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
            </select>
          </div>
          {/* Name Input */}
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              required
            />
          </div>
          {/* Release Year Input */}
          <div className="form-group">
            <label hidden={isEditing}>Release Year:</label>
            <input
              type="text"
              name="releaseYear"
              value={formData.releaseYear}
              onChange={handleFormChange}
              placeholder="Optional"
              hidden = {isEditing}
            />
          </div>
          {/* TMDB Field */}
          <div className="form-group">
            <label>TMDB:</label>
            {isEditing ? (
              // In edit mode, show a plain disabled text input with the TMDB id
              <input type="text" name="tmdb" value={formData.tmdb} disabled />
            ) : (
              // In add mode, render the dropdown with search button
              <div className="tmdb-group">
                <select name="tmdb" value={formData.tmdb} onChange={handleFormChange}>
                  <option value="">Select TMDB Record</option>
                  {tmdbOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.title} | {option.originalTitle} | {option.releaseDate}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={fetchTmdbResults} disabled={loadingTmdb}>
                  {loadingTmdb ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    'Search TMDB'
                  )}
                </button>
              </div>
            )}
          </div>
          {/* Show On Top Checkbox */}
          <div className="form-group checkbox-group">
            <label>Show On Top:</label>
            <input
              type="checkbox"
              name="showOnTop"
              checked={formData.showOnTop}
              onChange={handleFormChange}
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loadingSubmit}>
              {loadingSubmit ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                isEditing ? 'Update Record' : 'Add Record'
              )}
            </button>
            {isEditing && <button type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
      </div>

      {/* ag‑Grid Table */}
      <div className="grid-container ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={records}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={true}
          paginationPageSize={10}
          rowClassRules={rowClassRules}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalRecord && (
        <DeleteModal
          record={deleteModalRecord}
          onConfirm={handleConfirmDelete}
          onClose={handleCloseDeleteModal}
        />
      )}

      {Constants.TOAST_CONTAINER}
    </div>
  );
}

export default RecordsManagement;
