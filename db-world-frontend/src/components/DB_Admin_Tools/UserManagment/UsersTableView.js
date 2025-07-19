import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';

import { Box, IconButton, Tooltip, useTheme } from '@mui/material';
import { Delete, Edit, Refresh, Visibility } from '@mui/icons-material';
import { motion } from 'framer-motion';
import UserViewModal from './UserViewModal';
import UserEditModal from './UserEditModal';
// import { useSnackbar } from 'notistack';

const ActionsCellRenderer = (params) => {
  const { onEdit, onView, onDelete } = params.colDef.cellRendererParams;

  return (
    <Box display="flex" justifyContent="space-around">
      <Tooltip title="View">
        <IconButton size="small" onClick={() => onView(params.data)}>
          <Visibility fontSize="small" color="black" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <IconButton size="small" onClick={() => onEdit(params.data)}>
          <Edit fontSize="small" color="dark" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton size="small" onClick={() => onDelete(params.data.userId)}>
          <Delete fontSize="small" color="error" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const UsersTableView = ({ users, onDelete, onRefresh, onUpdate }) => {
  const [gridApi, setGridApi] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const theme = useTheme();
  // const { enqueueSnackbar } = useSnackbar();

  const handleView = (user) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleSave = async (updatedUser) => {
    try {
      await onUpdate(updatedUser);
      // enqueueSnackbar('User updated successfully', { variant: 'success' });
      setEditModalOpen(false);
    } catch (error) {
      // enqueueSnackbar('Failed to update user', { variant: 'error' });
      console.error("Update error:", error);
    }
  };

  const COLUMN_DEFS = [
    {
      headerName: 'Personal Data',
      children: [
        {
          headerName: 'ID',
          field: 'userId',
          width: 100,
          columnGroupShow: 'closed',
          cellStyle: { textAlign: 'center' }
        },
        {
          headerName: 'First Name',
          field: 'firstName',
          columnGroupShow: 'opened',
          pinned: "left",
          width: 120,
          cellStyle: { fontWeight: 'bold' }
        },
        { headerName: 'Last Name', field: 'lastName', width: 120, columnGroupShow: 'closed' },
        {
          headerName: 'Role',
          field: 'userRole.name',
          columnGroupShow: 'closed',
          width: 120,
          cellStyle: params => ({
            color: params.value === 'OWNER' && '#ff5722',
            fontWeight: params.value === 'OWNER' && 'bold'
          })
        },
        {
          headerName: 'Email',
          field: 'email',
          width: 200,
          tooltipField: 'email',
          columnGroupShow: 'closed'
        },
        {
          headerName: 'Mobile',
          field: 'mobileNo',
          width: 120,
          columnGroupShow: 'closed',
          cellStyle: { textAlign: 'center' }
        },
      ],
    },
    {
      headerName: 'Activity',
      children: [
        {
          headerName: 'Last Login',
          field: 'loginData.0.lastLoginDate',
          valueFormatter: params => params.value ? new Date(params.value).toLocaleString() : 'Never',
          width: 180
        },
        {
          headerName: 'Logins',
          field: 'noOfLogin',
          width: 100,
          cellStyle: { textAlign: 'center' }
        },
      ],
    },
    {
      headerName: "Actions",
      field: "actions",
      width: 150,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: {
        onEdit: handleEdit,
        onView: handleView,
        onDelete: onDelete,
      },
      sortable: false,
      filter: false,
    },
  ];

  const defaultColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    suppressMenu: true,
    cellClass: 'ag-text-wrap',
    autoHeight: true,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    
    >
      {/* <Box display="flex" justifyContent="flex-end" mb={2}>
        <Tooltip title="Refresh data">
          <IconButton onClick={onRefresh}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box> */}

      <div
        className="ag-theme-material"
        style={{
          height: '70vh',
          width: '100%',
          overflow: 'auto',
          '--ag-foreground-color': theme.palette.text.primary,
          '--ag-background-color': theme.palette.background.paper,
          '--ag-header-foreground-color': theme.palette.text.primary,
          '--ag-header-background-color': theme.palette.background.default,
          '--ag-border-color': theme.palette.divider,
        }}
      >
        <AgGridReact
          columnDefs={COLUMN_DEFS}
          defaultColDef={defaultColDef}
          onGridReady={(params) => setGridApi(params.api)}
          rowData={users}
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          suppressCellFocus={true}
        />
      </div>

      {/* View User Modal */}
      <UserViewModal
        user={selectedUser}
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
      />

      {/* Edit User Modal */}
      <UserEditModal
        user={selectedUser}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSave}
      />
    </motion.div>
  );
};

export default UsersTableView;