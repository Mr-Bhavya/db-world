import React, { useState } from 'react';
import {
    Paper, Box, Typography, Button, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import { ChevronRight, Delete as DeleteIcon, Folder, Refresh as RefreshIcon } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import SwitchWithLoader from './SwitchWithLoader';
import CommonServices from '../../CommonServices';
import RecordMediaFilesModal from './RecordMediaFilesModal';

const RecordsTableView = ({
    records,
    isMobile,
    onToggleShowOnTop,
    onRefreshTmdb,
    onDelete,
    loadingStates,
    refreshingRecords,
    loading
}) => {

    const [fileDialog, setFileDialog] = useState({
        open: false, record: null, files: [], type: null
    });

    const columns = React.useMemo(() => [
        {
            field: 'id',
            headerName: 'ID',
            flex: isMobile ? 0 : 1,
            minWidth: 80
        },
        {
            field: 'type',
            headerName: 'Type',
            flex: isMobile ? 0 : 1,
            minWidth: 80
        },
        {
            field: 'name',
            headerName: 'Name',
            flex: 2,
            minWidth: 150
        },
        {
            field: 'tmdb',
            headerName: 'TMDB',
            flex: isMobile ? 0 : 1,
            minWidth: 80,
            renderCell: (params) => params.value || '-'
        },
        {
            field: 'stream_file_list',
            headerName: 'Files',
            flex: isMobile ? 1 : 1.5,
            minWidth: 120,
            renderCell: (params) => {
                const files = params.value || [];
                if (files.length === 0) return '-';

                const totalSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
                const formatSize = CommonServices.bytesToReadbleFormat(totalSize);

                return (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            width: '100%'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setFileDialog({
                                open: true,
                                record: params.row,
                                files: params.row.stream_file_list || [],
                                type: params.row.type
                            });
                        }}
                    >
                        <Folder fontSize="small" color="action" sx={{ mr: 1 }} />
                        <Box sx={{ flexGrow: 0, alignItems: 'start', display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">
                                {files.length} file{files.length !== 1 ? 's' : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {formatSize.value} {formatSize.suffix}
                            </Typography>
                        </Box>
                        <ChevronRight fontSize="small" color="action" />
                    </Box>
                );
            }
        },
        ...(isMobile ? [] : [
            {
                field: 'creationDate',
                headerName: 'Created',
                flex: 1.5,
                renderCell: (params) => new Date(params.value).toLocaleDateString()
            },
            {
                field: 'lastModifiedDate',
                headerName: 'Modified',
                flex: 1.5,
                renderCell: (params) => new Date(params.value).toLocaleDateString()
            }
        ]),
        {
            field: 'showOnTop',
            headerName: 'Top',
            width: 80,
            renderCell: (params) => (
                <Tooltip title={params.value ? 'Showing on top' : 'Not showing on top'}>
                    <SwitchWithLoader
                        checked={params.value}
                        onChange={() => onToggleShowOnTop(params.row.id, params.value)}
                        loading={loadingStates[params.row.id]}
                    />
                </Tooltip>
            )
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: isMobile ? 120 : 150,
            renderCell: (params) => (
                <Box sx={{ display: 'flex' }}>
                    <Tooltip title="Refresh TMDB">
                        <IconButton
                            size="small"
                            onClick={() => onRefreshTmdb(params.row.id)}
                            disabled={refreshingRecords[params.row.id]}
                            sx={{ p: isMobile ? 0.5 : 1 }}
                        >
                            {refreshingRecords[params.row.id] ? (
                                <CircularProgress size={isMobile ? 16 : 24} />
                            ) : (
                                <RefreshIcon fontSize={isMobile ? 'small' : 'medium'} color="action" />
                            )}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton
                            size="small"
                            onClick={() => onDelete(params.row)}
                            sx={{ p: isMobile ? 0.5 : 1 }}
                        >
                            <DeleteIcon fontSize={isMobile ? 'small' : 'medium'} color="error" />
                        </IconButton>
                    </Tooltip>
                </Box>
            )
        }
    ], [isMobile, refreshingRecords, loadingStates, onToggleShowOnTop, onRefreshTmdb, onDelete]);

    return (
        <Paper sx={{ height: '70vh', width: '100%', overflowX: 'auto' }}>
            <DataGrid
                rows={records}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[10, 25, 50]}
                disableSelectionOnClick
                loading={loading}
                density={isMobile ? 'compact' : 'standard'}
                disableColumnMenu
                disableVirtualization={isMobile}
                columnBuffer={5}
                rowBuffer={20}
                getRowHeight={() => 'auto'}
                components={{
                    NoRowsOverlay: () => (
                        <Box sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2
                        }}>
                            <Typography variant="body1" color="textSecondary">
                                No records found
                            </Typography>
                        </Box>
                    )
                }}
            />

            <RecordMediaFilesModal
                fileDialog={fileDialog}
                setFileDialog={setFileDialog}
                open={fileDialog.open}
                onClose={() => setFileDialog(prev => ({ ...prev, open: false }))}
                record={fileDialog.record}
                files={fileDialog.files}
                type={fileDialog.type}
            />

        </Paper>
    );
};

export default RecordsTableView;