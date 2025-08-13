import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination, TextField, InputAdornment, IconButton,
    Tooltip, Collapse, Chip, Avatar, useTheme, styled, tableCellClasses,
    CircularProgress, MenuItem, FormControl, Select
} from '@mui/material';
import {
    Search as SearchIcon, FilterAlt as FilterIcon, ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon, Refresh as RefreshIcon, Code as CodeIcon,
    Schedule as ScheduleIcon, Person as PersonIcon, Public as PublicIcon,
    Computer as ComputerIcon, Http as HttpIcon, QueryStats as QueryStatsIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import jsonFormat from 'json-format';
import debounce from 'lodash/debounce';
import axiosInstance from '../../Utils/AxiosInstants';
import UsernameAutocomplete from './UsernameAutocomplete';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.common.white,
        fontWeight: 'bold',
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
    },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.action.hover,
    },
    '&:last-child td, &:last-child th': {
        border: 0,
    },
}));

const StatusChip = React.memo(({ status }) => {
    let color = 'default';
    if (status >= 200 && status < 300) color = 'success';
    else if (status >= 300 && status < 400) color = 'info';
    else if (status >= 400 && status < 500) color = 'warning';
    else if (status >= 500) color = 'error';

    return <Chip label={status} color={color} size="small" />;
});

const MethodChip = React.memo(({ method }) => {
    const methodColors = {
        GET: 'primary',
        POST: 'success',
        PUT: 'warning',
        DELETE: 'error',
        PATCH: 'secondary'
    };

    return (
        <Chip
            label={method}
            color={methodColors[method] || 'default'}
            size="small"
            variant="outlined"
        />
    );
});

const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: '200', label: '200 OK' },
    { value: '201', label: '201 Created' },
    { value: '204', label: '204 No Content' },
    { value: '400', label: '400 Bad Request' },
    { value: '401', label: '401 Unauthorized' },
    { value: '403', label: '403 Forbidden' },
    { value: '404', label: '404 Not Found' },
    { value: '500', label: '500 Server Error' }
];

const methodOptions = [
    { value: '', label: 'All Methods' },
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'DELETE', label: 'DELETE' },
    { value: 'PATCH', label: 'PATCH' }
];

const UserActivityLogs = () => {
    const theme = useTheme();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);
    const [totalItems, setTotalItems] = useState(0);
    const [filters, setFilters] = useState({
        status: '',
        method: '',
        username: ''
    });
    const [error, setError] = useState(null);
    const usernameSearchInProgress = useRef(false);

    const fetchLogs = useCallback(async (params) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get('/api/admin/activity-logs', {
                params: {
                    ...params,
                    page: params.page || 0,
                    size: params.size || rowsPerPage,
                    sort: 'timestamp,desc'
                }
            });
            setLogs(response.data.content || []);
            setTotalItems(response.data.totalElements || 0);
        } catch (error) {
            console.error('Error fetching logs:', error);
            setError('Failed to fetch logs. Please try again.');
            setLogs([]);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    }, [rowsPerPage]);

    const debouncedFetchLogs = useMemo(() =>
        debounce((params) => {
            if (!usernameSearchInProgress.current) {
                fetchLogs(params);
            }
        }, 500),
        [fetchLogs]
    );

    // Initial fetch on mount and when rowsPerPage changes
    useEffect(() => {
        fetchLogs({
            page: 0,
            size: rowsPerPage
        });
    }, [fetchLogs, rowsPerPage]);

    // Fetch logs when filters, search term, or page changes
    useEffect(() => {
        const params = {
            page,
            size: rowsPerPage,
            ...(searchTerm && { search: searchTerm }),
            ...(filters.method && { method: filters.method }),
            ...(filters.status && { status: filters.status }),
            ...(filters.username && { username: filters.username })
        };

        debouncedFetchLogs(params);
        return () => debouncedFetchLogs.cancel();
    }, [page, rowsPerPage, searchTerm, filters, debouncedFetchLogs]);

    const handleUsernameChange = (value) => {
        setFilters(prev => ({
            ...prev,
            username: value?.value || ''
        }));
        setPage(0);
    };

    const handleUsernameInputChange = useCallback((inputValue) => {
        usernameSearchInProgress.current = !!inputValue;
    }, []);

    const handleExpandRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const handleChangePage = (_, newPage) => setPage(newPage);

    const handleChangeRowsPerPage = (e) => {
        setRowsPerPage(parseInt(e.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setPage(0);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(0);
    };

    const handleRefresh = () => {
        fetchLogs({
            page,
            size: rowsPerPage,
            ...(searchTerm && { search: searchTerm }),
            ...(filters.method && { method: filters.method }),
            ...(filters.status && { status: filters.status }),
            ...(filters.username && { username: filters.username })
        });
    };

    const renderRowDetails = (log) => (
        <Box sx={{ p: 3, backgroundColor: theme.palette.background.default }}>
            <Typography variant="h6" gutterBottom>Request Details</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
                {[
                    { icon: <PersonIcon />, label: 'User', value: log.username },
                    // { icon: <PublicIcon />, label: 'IP Address', value: log.ip },
                    { icon: <ComputerIcon />, label: 'User Agent', value: log.userAgent },
                    { icon: <QueryStatsIcon />, label: 'Performance', value: `${log.duration}ms` },
                    { icon: <ScheduleIcon />, label: 'Timestamp', value: new Date(log.timestamp).toLocaleString() },
                    // { icon: <HttpIcon />, label: 'Request ID', value: log.requestId }
                ].map((item, i) => (
                    <Paper key={i} sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {item.icon}
                            <Typography variant="subtitle1">{item.label}</Typography>
                        </Box>
                        <Typography variant="body2">{item.value}</Typography>
                    </Paper>
                ))}
            </Box>

            {log.requestBody && (
                <Paper sx={{ p: 2, mt: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CodeIcon color="primary" />
                        <Typography variant="subtitle1">Request Body</Typography>
                    </Box>
                    <Box sx={{
                        p: 1,
                        backgroundColor: theme.palette.grey[100],
                        borderRadius: 1,
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                    }}>
                        <pre>{jsonFormat(JSON.parse(log.requestBody), { type: 'space', size: 2 })}</pre>
                    </Box>
                </Paper>
            )}
        </Box>
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h4" fontWeight="bold">User Activity Logs</Typography>
                    <Tooltip title="Refresh logs">
                        <IconButton onClick={handleRefresh}><RefreshIcon /></IconButton>
                    </Tooltip>
                </Box>

                {error && (
                    <Paper sx={{ mb: 3, p: 2, backgroundColor: theme.palette.error.light }}>
                        <Typography color="error">{error}</Typography>
                    </Paper>
                )}

                <Paper sx={{ mb: 3, p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flexGrow: 1, maxWidth: 400 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                                value={filters.method}
                                onChange={(e) => handleFilterChange('method', e.target.value)}
                                displayEmpty
                            >
                                {methodOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                displayEmpty
                            >
                                {statusOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Box sx={{ minWidth: 200 }}>
                            <UsernameAutocomplete
                                value={filters.username}
                                onChange={handleUsernameChange}
                                onInputChange={handleUsernameInputChange}
                            />
                        </Box>
                    </Box>
                </Paper>

                <Paper sx={{ overflow: 'hidden', position: 'relative' }}>
                    {loading && (
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.7)', zIndex: 1
                        }}>
                            <CircularProgress />
                        </Box>
                    )}

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <StyledTableCell>Details</StyledTableCell>
                                    <StyledTableCell>User</StyledTableCell>
                                    <StyledTableCell>Request</StyledTableCell>
                                    <StyledTableCell>Method</StyledTableCell>
                                    <StyledTableCell>Status</StyledTableCell>
                                    <StyledTableCell>Duration</StyledTableCell>
                                    <StyledTableCell>Timestamp</StyledTableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.length > 0 ? logs.map((log) => (
                                    <React.Fragment key={log.id}>
                                        <StyledTableRow hover onClick={() => handleExpandRow(log.id)}>
                                            <StyledTableCell>
                                                <IconButton size="small">
                                                    {expandedRow === log.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.primary.main }}>
                                                        {log.username?.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    {log.username}
                                                </Box>
                                            </StyledTableCell>
                                            <StyledTableCell>
                                                <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                                                    {log.uri}
                                                </Typography>
                                                {log.query && (
                                                    <Tooltip title={log.query} placement="top">
                                                        <Typography variant="caption" noWrap color="text.secondary">
                                                            ?{log.query.length > 50 ? `${log.query.substring(0, 50)}...` : log.query}
                                                        </Typography>
                                                    </Tooltip>
                                                )}
                                            </StyledTableCell>
                                            <StyledTableCell><MethodChip method={log.method} /></StyledTableCell>
                                            <StyledTableCell><StatusChip status={log.status} /></StyledTableCell>
                                            <StyledTableCell>{log.duration}ms</StyledTableCell>
                                            <StyledTableCell>
                                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                            </StyledTableCell>
                                        </StyledTableRow>
                                        <TableRow>
                                            <TableCell style={{ padding: 0 }} colSpan={7}>
                                                <Collapse in={expandedRow === log.id} timeout="auto" unmountOnExit>
                                                    {renderRowDetails(log)}
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                            {loading ? 'Loading...' : 'No logs found'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={totalItems}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </Paper>
            </Box>
        </motion.div>
    );
};

export default React.memo(UserActivityLogs);