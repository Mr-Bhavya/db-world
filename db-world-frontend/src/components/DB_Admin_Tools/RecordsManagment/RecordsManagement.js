import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { FaEdit, FaTrash, FaSync, FaAd, FaPlus } from 'react-icons/fa';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './RecordsManagement.css';
import { AddDbCinemaRecord, changeShowOnTopRecord, deleteDbCinemaRecord, getRecords, searchTmdbByQuery, UpdateDbCinemaRecord } from '../../ApiServices';
import { toast } from 'react-toastify';
import { useLocation, useNavigate } from 'react-router-dom';
import DeleteModal from './DeleteModal';
import Constants from '../../Constants';
import RecordModal from './RecordModal';
import { Button, Col, Container, Row } from 'react-bootstrap';

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

  //add or edit record Modal
  const [showRecordModal, setShowRecordModal] = useState(false);
  const handleOpenRecordModal = () => setShowRecordModal(true);
  const handleCloseRecordModal = () => setShowRecordModal(false);

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
    handleOpenRecordModal();
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

  const handleSwitchShowOnTop = async (recordId, showOnTop) => {
    let updateRecordRes = await changeShowOnTopRecord(recordId, showOnTop);
    if (updateRecordRes.httpStatusCode === 200) {
      toast.success("Show On Top updated successfully for record " + recordId);
      await getAllRecords();
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
  }

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
    handleCloseRecordModal();
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
    }
    ,
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
      field: 'showOnTop',
      headerName: 'Show On Top',
      filter: true,
      sortable: true,
      cellRenderer: (params) => {
        const handleToggle = async () => {
          const updatedValue = !params.value;
          // Update the underlying data for the 'updating' flag.
          params.data.updating = true;
          // Refresh the cell so the spinner appears.
          params.api.refreshCells({ rowNodes: [params.node], force: true });
          try {
            // Call your API to update the value.
            await handleSwitchShowOnTop(params.data.id, updatedValue);
            // Now update the 'showOnTop' value.
            if (params.node) {
              params.node.setDataValue('showOnTop', updatedValue);
            } else {
              params.data.showOnTop = updatedValue;
              params.api.refreshCells({ force: true });
            }
          } catch (error) {
            console.error('API update failed: ', error);
            // Optionally, you could revert the change here.
          } finally {
            // Remove the updating flag.
            params.data.updating = false;
            if (params.node) {
              params.api.refreshCells({ rowNodes: [params.node], force: true });
            } else {
              params.api.refreshCells({ force: true });
            }
          }
        };

        // If the row is updating, show a spinner.
        if (params.data.updating) {
          return (
            <span
              className="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            ></span>
          );
        }

        // Otherwise, show the interactive switch.
        return (
          <div
            className="form-check form-switch my-2"
            onClick={handleToggle}
            title={params.value ? 'Turn Off' : 'Turn On'}
          >
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={params.value}
              readOnly
            />
          </div>
        );
      }
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
    <Container fluid className="records-management m-0 p-0">
      {/* Header with Add Record Button */}
      <Row className="my-3 d-flex flex-column flex-md-row align-items-md-center">
        {/* Title - Centered on Mobile, Left on Desktop */}
        <Col xs={12} md={8} className="d-flex justify-content-center text-center text-md-start">
          <h1 className="mb-2 mb-md-0"><u>Record Management</u></h1>
        </Col>

        {/* Add Record Button - Centered on Mobile, Right on Desktop */}
        <Col xs={12} md={4} className="d-flex justify-content-end justify-content-md-end">
          <Button variant="" className='btn btn-outline-dark btn-sm' onClick={handleOpenRecordModal}>
            <FaPlus /> <span className='m-1'>Add Record</span>
          </Button>
        </Col>
      </Row>

      {/* Record Modal */}
      <RecordModal
        show={showRecordModal}
        handleClose={handleCloseRecordModal}
        isEditing={isEditing}
        formData={formData}
        handleFormChange={handleFormChange}
        handleFormSubmit={handleFormSubmit}
        resetForm={resetForm}
        loadingSubmit={loadingSubmit}
        tmdbOptions={tmdbOptions}
        fetchTmdbResults={fetchTmdbResults}
        loadingTmdb={loadingTmdb}
      />

      {/* ag-Grid Table */}
      <div className="grid-container ag-theme-alpine">
        <AgGridReact
          ref={gridRef}
          rowData={records}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={true}
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
    </Container>
  );
}

export default RecordsManagement;