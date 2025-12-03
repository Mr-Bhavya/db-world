import React, { useMemo } from 'react';
import {
    Box, Typography, CircularProgress, useTheme, useMediaQuery,
    IconButton, Tooltip, Chip, Avatar, Menu, MenuItem,
    Button
} from '@mui/material';
import {
    ViewList as ViewListIcon,
    Theaters as TheatersIcon,
    LiveTv as TvIcon,
    Refresh as RefreshIcon,
    Delete as DeleteIcon,
    Star as StarIcon,
    Link as LinkIcon,
    LinkOff as UnlinkIcon,
    Folder as FolderIcon,
    Storage as StorageIcon,
    FirstPage as FirstPageIcon,
    LastPage as LastPageIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    FilterList as FilterListIcon,
    ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { DataGrid, GridPagination } from '@mui/x-data-grid';
import { motion } from 'framer-motion';
import SwitchWithLoader from './SwitchWithLoader';
import CommonServices from '../../CommonServices';

const MotionBox = motion(Box);

// Cell Components
const TMDBLinkCell = ({ value }) => {
    const hasLink = !!value;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasLink ? (
                <Tooltip title={`TMDB ID: ${value}`}>
                    <Chip
                        icon={<LinkIcon />}
                        label={value}
                        size="small"
                        color="success"
                        variant="filled"
                        sx={{
                            fontWeight: 600,
                            '& .MuiChip-icon': { color: 'white !important' },
                            '& .MuiChip-label': { color: 'white !important' }
                        }}
                    />
                </Tooltip>
            ) : (
                <Tooltip title="No TMDB Link">
                    <Chip
                        icon={<UnlinkIcon />}
                        label="Not Linked"
                        size="small"
                        variant="outlined"
                        color="default"
                        sx={{
                            '& .MuiChip-label': { color: 'text.primary !important' }
                        }}
                    />
                </Tooltip>
            )}
        </Box>
    );
};

const FileCell = ({ files, record, onFileDialogOpen }) => {
    const theme = useTheme();

    if (!files || files.length === 0) {
        return (
            <Chip
                label="No Files"
                size="small"
                variant="outlined"
                sx={{
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { color: 'text.primary !important' }
                }}
            />
        );
    }

    const totalSize = files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
    const formatSize = CommonServices.bytesToReadbleFormat(totalSize);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                p: 0.5,
                borderRadius: 1,
                height: '100%',
                '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                }
            }}
            onClick={(e) => {
                e.stopPropagation();
                onFileDialogOpen(record, files);
            }}
        >
            <FolderIcon fontSize="small" color="primary" sx={{ fontSize: 18 }} />
            <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
                <Typography variant="body2" fontWeight="500" sx={{ fontSize: '0.8rem', color: 'text.primary' }} noWrap>
                    {files.length} file{files.length !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }} noWrap>
                    {formatSize.value} {formatSize.suffix}
                </Typography>
            </Box>
        </Box>
    );
};

const DateCell = ({ value }) => (
    <Typography variant="body2" color="text.primary" noWrap title={new Date(value).toLocaleString()}>
        {new Date(value).toLocaleDateString()}
    </Typography>
);

const TypeCell = ({ value }) => {
    const isMovie = value === 'movie';
    const Icon = isMovie ? TheatersIcon : TvIcon;

    return (
        <Chip
            icon={<Icon sx={{ fontSize: 16 }} />}
            label={isMovie ? 'Movie' : 'TV Show'}
            color={isMovie ? 'primary' : 'secondary'}
            variant="filled"
            size="small"
            sx={{
                fontWeight: 600,
                '& .MuiChip-icon': { color: 'white !important' },
                '& .MuiChip-label': { color: 'white !important' }
            }}
        />
    );
};

const RecordsTableView = ({
    records,
    isMobile,
    onToggleShowOnTop,
    onRefreshTmdb,
    onDelete,
    loadingStates,
    refreshingRecords,
    loading,
    onFileDialogOpen,
    // Pagination props
    paginationModel,
    onPaginationModelChange,
    totalRecords,
    pageSizeOptions = [10, 25, 50, 100],
    // Sorting props
    sortModel,
    onSortModelChange,
    // Filter props
    filterModel,
    onFilterModelChange
}) => {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [pageSizeMenuAnchor, setPageSizeMenuAnchor] = React.useState(null);

    // Define columns with all requested fields
    const columns = useMemo(() => {
        const baseColumns = [
            {
                field: 'id',
                headerName: 'ID',
                width: 80,
                renderCell: (params) => (
                    <Typography variant="body2" fontWeight="600" color="primary">
                        #{params.value}
                    </Typography>
                )
            },
            {
                field: 'type',
                headerName: 'Type',
                width: 110,
                renderCell: (params) => <TypeCell value={params.value} />,
                sortable: false,
                filterable: false
            },
            {
                field: 'name',
                headerName: 'Title',
                flex: 1,
                minWidth: 200,
                renderCell: (params) => (
                    <Box>
                        <Typography variant="body2" fontWeight="600" color="text.primary" noWrap title={params.value}>
                            {params.value}
                        </Typography>
                        {params.row.tmdb && (
                            <Typography variant="caption" color="text.secondary">
                                TMDB: {params.row.tmdb}
                            </Typography>
                        )}
                    </Box>
                ),
                sortable: false,
                filterable: false
            },
            {
                field: 'tmdb',
                headerName: 'TMDB',
                width: 130,
                renderCell: (params) => <TMDBLinkCell value={params.value} />,
                sortable: false,
                filterable: false
            },
            {
                field: 'stream_file_list',
                headerName: 'Media Files',
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <FileCell
                        files={params.value}
                        record={params.row}
                        onFileDialogOpen={onFileDialogOpen}
                    />
                ),
                sortable: false,
                filterable: false
            },
            ...(isSmallScreen ? [] : [
                {
                    field: 'creation_date',
                    headerName: 'Created',
                    width: 120,
                    renderCell: (params) => <DateCell value={params.value} />,
                    sortable: false,
                    filterable: false
                },
                {
                    field: 'last_modified_date',
                    headerName: 'Modified',
                    width: 120,
                    renderCell: (params) => <DateCell value={params.value} />,
                    sortable: false,
                    filterable: false
                }
            ]),
            {
                field: 'show_on_top',
                headerName: 'Featured',
                width: 110,
                align: 'center',
                headerAlign: 'center',
                renderCell: (params) => (
                    <Tooltip title={params.value ? 'Featured on top' : 'Not featured'}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <StarIcon
                                sx={{
                                    fontSize: 18,
                                    color: params.value ? theme.palette.warning.main : 'text.disabled'
                                }}
                            />
                            <SwitchWithLoader
                                checked={params.value}
                                onChange={() => onToggleShowOnTop(params.row.id, params.value)}
                                loading={loadingStates[params.row.id]}
                                size="small"
                            />
                        </Box>
                    </Tooltip>
                ),
                sortable: false,
                filterable: false
            },
            {
                field: 'actions',
                headerName: 'Actions',
                width: isSmallScreen ? 120 : 140,
                align: 'center',
                headerAlign: 'center',
                renderCell: (params) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Refresh TMDB Data">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRefreshTmdb(params.row.id);
                                }}
                                disabled={refreshingRecords[params.row.id]}
                                sx={{
                                    backgroundColor: theme.palette.action.hover,
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.main,
                                        color: 'white'
                                    }
                                }}
                            >
                                {refreshingRecords[params.row.id] ? (
                                    <CircularProgress size={16} />
                                ) : (
                                    <RefreshIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Record">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(params.row);
                                }}
                                sx={{
                                    backgroundColor: theme.palette.action.hover,
                                    '&:hover': {
                                        backgroundColor: theme.palette.error.main,
                                        color: 'white'
                                    }
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ),
                sortable: false,
                filterable: false
            }
        ];

        return baseColumns;
    }, [
        isSmallScreen,
        refreshingRecords,
        loadingStates,
        theme,
        onToggleShowOnTop,
        onRefreshTmdb,
        onDelete,
        onFileDialogOpen
    ]);

    // Handle page size change
    const handlePageSizeChange = (newPageSize) => {
        onPaginationModelChange({
            page: 0, // Reset to first page when changing page size
            pageSize: newPageSize
        });
        setPageSizeMenuAnchor(null);
    };

    // Custom pagination component
    const CustomPagination = () => {
        const { page, pageSize } = paginationModel;
        const totalPages = Math.ceil(totalRecords / pageSize);
        const startRecord = page * pageSize + 1;
        const endRecord = Math.min((page + 1) * pageSize, totalRecords);

        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderTop: `1px solid ${theme.palette.divider}`,
                flexWrap: 'wrap',
                gap: 1,
                backgroundColor: theme.palette.background.default
            }}>
                {/* Records info */}
                <Typography variant="body2" color="text.primary">
                    {totalRecords === 0 ? 'No records' : `Showing ${startRecord}-${endRecord} of ${totalRecords}`}
                </Typography>

                {/* Pagination controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Page size selector */}
                    <Tooltip title="Change page size">
                        <Button
                            variant="outlined"
                            size="small"
                            endIcon={<ArrowDropDownIcon />}
                            onClick={(e) => setPageSizeMenuAnchor(e.currentTarget)}
                        >
                            {pageSize} / page
                        </Button>

                    </Tooltip>

                    {/* Navigation buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="First page">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => onPaginationModelChange({ page: 0, pageSize })}
                                    disabled={page === 0}
                                >
                                    <FirstPageIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Previous page">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => onPaginationModelChange({ page: page - 1, pageSize })}
                                    disabled={page === 0}
                                >
                                    <ChevronLeftIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Typography variant="body2" sx={{
                            minWidth: 60,
                            textAlign: 'center',
                            fontWeight: 600,
                            color: 'text.primary'
                        }}>
                            {totalPages === 0 ? '0/0' : `${page + 1} / ${totalPages}`}
                        </Typography>

                        <Tooltip title="Next page">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => onPaginationModelChange({ page: page + 1, pageSize })}
                                    disabled={page >= totalPages - 1}
                                >
                                    <ChevronRightIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Last page">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => onPaginationModelChange({ page: totalPages - 1, pageSize })}
                                    disabled={page >= totalPages - 1}
                                >
                                    <LastPageIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Page Size Menu */}
                <Menu
                    anchorEl={pageSizeMenuAnchor}
                    open={Boolean(pageSizeMenuAnchor)}
                    onClose={() => setPageSizeMenuAnchor(null)}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    container={document.body}  // <--- REQUIRED FIX
                >


                    {pageSizeOptions.map((size) => (
                        <MenuItem
                            key={size}
                            selected={pageSize === size}
                            onClick={() => handlePageSizeChange(size)}
                            sx={{
                                color: 'text.primary',
                                '&.Mui-selected': {
                                    backgroundColor: `${theme.palette.primary.main}20`,
                                    '&:hover': {
                                        backgroundColor: `${theme.palette.primary.main}30`,
                                    }
                                }
                            }}
                        >
                            {size} per page
                        </MenuItem>
                    ))}
                </Menu>
            </Box>
        );
    };

    return (
        <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <DataGrid
                rows={records}
                columns={columns}

                // Server-side pagination
                pagination
                paginationMode="server"
                rowCount={totalRecords}
                pageSizeOptions={pageSizeOptions}
                paginationModel={paginationModel}
                onPaginationModelChange={onPaginationModelChange}

                // Server-side sorting
                sortingMode="server"
                sortModel={sortModel}
                onSortModelChange={onSortModelChange}

                // Server-side filtering
                filterMode="server"
                filterModel={filterModel}
                onFilterModelChange={onFilterModelChange}

                // Selection and interaction
                disableRowSelectionOnClick
                disableColumnMenu={false}
                disableColumnSelector={false}
                disableDensitySelector={false}

                // Performance
                columnBuffer={isSmallScreen ? 2 : 3}
                rowBuffer={isSmallScreen ? 5 : 10}
                loading={loading}

                // Density and sizing
                density={isSmallScreen ? "compact" : "standard"}
                getRowHeight={() => 'auto'}
                autoHeight={false}

                sx={{
                    height: '70vh',
                    minHeight: 400,
                    maxHeight: 'calc(100vh - 300px)',
                    border: 'none',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backgroundColor: theme.palette.background.paper,

                    // Cell styles - BLACK TEXT
                    '& .MuiDataGrid-cell': {
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        alignItems: 'center',
                        py: 1,
                        color: 'text.primary', // Ensure black text
                        '&:focus': {
                            outline: 'none',
                        },
                        '&:focus-within': {
                            outline: 'none',
                        },
                    },

                    // Column header styles - BLACK TEXT
                    '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: theme.palette.background.default,
                        borderBottom: `2px solid ${theme.palette.primary.main}`,
                        borderRadius: '12px 12px 0 0',
                        '& .MuiDataGrid-columnHeader': {
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: 'text.primary', // Black header text
                            '&:focus': {
                                outline: 'none',
                            },
                        },
                        '& .MuiDataGrid-columnHeaderTitle': {
                            fontWeight: 600,
                            color: 'text.primary', // Black header text
                        },
                        '& .MuiDataGrid-columnHeaderTitleContainer': {
                            color: 'text.primary', // Black header text
                        },
                        '& .MuiDataGrid-menuIcon': {
                            color: 'text.primary', // Black menu icon
                        },
                        '& .MuiDataGrid-sortIcon': {
                            color: 'text.primary', // Black sort icon
                        }
                    },

                    // Row styles
                    '& .MuiDataGrid-row': {
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        color: 'text.primary', // Black row text
                        '&:hover': {
                            backgroundColor: `${theme.palette.primary.main}08 !important`,
                        },
                        '&.Mui-selected': {
                            backgroundColor: `${theme.palette.primary.main}12 !important`,
                            '&:hover': {
                                backgroundColor: `${theme.palette.primary.main}16 !important`,
                            }
                        },
                    },

                    // Footer styles
                    '& .MuiDataGrid-footerContainer': {
                        borderTop: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.background.default,
                        color: 'text.primary', // Black footer text
                    },

                    // Virtual scroller styles
                    '& .MuiDataGrid-virtualScroller': {
                        color: 'text.primary', // Black text in virtual scroller
                        '&::-webkit-scrollbar': {
                            width: 8,
                            height: 8,
                        },
                        '&::-webkit-scrollbar-track': {
                            background: theme.palette.background.default,
                            borderRadius: 4,
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: theme.palette.primary.main,
                            borderRadius: 4,
                            '&:hover': {
                                background: theme.palette.primary.dark,
                            }
                        }
                    },

                    // Loading overlay
                    '& .MuiDataGrid-overlay': {
                        backgroundColor: theme.palette.background.paper,
                        color: 'text.primary', // Black loading text
                    },

                    // Column menu styles - FIXED BLACK TEXT
                    '& .MuiDataGrid-menu': {
                        '& .MuiPaper-root': {
                            backgroundColor: theme.palette.background.paper,
                            color: 'text.primary',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            '& .MuiMenuItem-root': {
                                color: 'text.primary',
                                fontSize: '0.875rem',
                                '&:hover': {
                                    backgroundColor: theme.palette.action.hover,
                                },
                                '&.Mui-selected': {
                                    backgroundColor: `${theme.palette.primary.main}20`,
                                    color: 'primary.main',
                                    '&:hover': {
                                        backgroundColor: `${theme.palette.primary.main}30`,
                                    }
                                }
                            },
                            '& .MuiList-root': {
                                color: 'text.primary',
                            '& .MuiMenuItem-root': {
                                color: 'text.primary',
                            }
                        }
                    },
                    },

                    // Filter panel styles
                    '& .MuiDataGrid-filterForm': {
                        backgroundColor: theme.palette.background.paper,
                        color: 'text.primary',
                        '& .MuiInputBase-root': {
                            color: 'text.primary',
                            '& .MuiInputBase-input': {
                                color: 'text.primary',
                            }
                        },
                        '& .MuiInputLabel-root': {
                            color: 'text.primary',
                        },
                        '& .MuiFormControlLabel-root': {
                            color: 'text.primary',
                        },
                        '& .MuiTypography-root': {
                            color: 'text.primary',
                        }
                    },

                    // Toolbar styles
                    '& .MuiDataGrid-toolbarContainer': {
                        color: 'text.primary',
                        '& .MuiButton-root': {
                            color: 'text.primary',
                        }
                    },

                    // Column selector styles - FIXED BLACK TEXT
                    '& .MuiDataGrid-columnsPanel': {
                        backgroundColor: theme.palette.background.paper,
                        color: 'text.primary',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        '& .MuiDataGrid-panelHeader': {
                            color: 'text.primary',
                        },
                        '& .MuiDataGrid-columnsPanelRow': {
                            color: 'text.primary',
                            '& .MuiCheckbox-root': {
                                color: 'text.primary',
                            },
                            '& .MuiFormControlLabel-root': {
                                color: 'text.primary',
                                '& .MuiTypography-root': {
                                    color: 'text.primary',
                                }
                            }
                        }
                    },

                    // Density selector styles
                    '& .MuiDataGrid-panel': {
                        backgroundColor: theme.palette.background.paper,
                        color: 'text.primary',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        '& .MuiMenuItem-root': {
                            color: 'text.primary',
                            '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                            }
                        }
                    }
                }}


                // Custom components
                slots={{
                    pagination: GridPagination,

                    loadingOverlay: () => (
                        <Box sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            backgroundColor: theme.palette.background.paper,
                        }}>
                            <CircularProgress size={40} />
                            <Typography variant="body1" color="text.primary">
                                Loading records...
                            </Typography>
                        </Box>
                    ),

                    noRowsOverlay: () => (
                        <Box sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 3,
                            gap: 2,
                            backgroundColor: theme.palette.background.paper,
                        }}>
                            <TheatersIcon sx={{
                                fontSize: 64,
                                color: 'text.secondary',
                                opacity: 0.5
                            }} />
                            <Typography variant="h6" color="text.primary" textAlign="center">
                                No records found
                            </Typography>
                            <Typography variant="body2" color="text.secondary" textAlign="center">
                                Try adjusting your search or filters
                            </Typography>
                        </Box>
                    ),
                }}
            />
        </MotionBox>
    );
};

export default RecordsTableView;