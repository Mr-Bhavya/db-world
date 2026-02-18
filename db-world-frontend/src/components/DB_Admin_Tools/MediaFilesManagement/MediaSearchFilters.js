import React from 'react';
import {
    Box,
    Paper,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Collapse,
    Typography,
    useTheme,
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    FilterAlt as FilterAltIcon,
    GridView as GridViewIcon,
    List as ListIcon,
    Sort as SortIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';

const MediaSearchFilters = ({
    isMobile,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode,
    showAdvancedFilters,
    setShowAdvancedFilters,
    filterMinSize,
    setFilterMinSize,
    filterMaxSize,
    setFilterMaxSize,
    filterFormat,
    setFilterFormat,
    filterLanguage,
    setFilterLanguage,
    stats,
    selectedFiles,
    setDialogOpen,
    setSelectedFiles,
    formatFileSize,
}) => {
    const theme = useTheme();
    
    return (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={4}>
                    <TextField
                        fullWidth
                        placeholder="Search files..."
                        variant="outlined"
                        size="small"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={sortBy}
                                label="Sort By"
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <MenuItem value="name">Name</MenuItem>
                                <MenuItem value="size">Size</MenuItem>
                                <MenuItem value="date">Date Modified</MenuItem>
                            </Select>
                        </FormControl>
                        <IconButton 
                            size="small" 
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        >
                            <SortIcon />
                        </IconButton>
                    </Box>
                </Grid>
                
                <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
                        <Button
                            size="small"
                            startIcon={<FilterAltIcon />}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            variant={showAdvancedFilters ? "contained" : "outlined"}
                        >
                            Filters
                        </Button>
                        <Button
                            size="small"
                            startIcon={viewMode === 'table' ? <GridViewIcon /> : <ListIcon />}
                            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                            variant="outlined"
                        >
                            {viewMode === 'table' ? 'Grid' : 'List'}
                        </Button>
                    </Box>
                </Grid>
            </Grid>

            {/* Advanced Filters */}
            <Collapse in={showAdvancedFilters}>
                <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                label="Min Size"
                                size="small"
                                value={filterMinSize}
                                onChange={(e) => setFilterMinSize(e.target.value)}
                                placeholder="e.g., 1GB"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                label="Max Size"
                                size="small"
                                value={filterMaxSize}
                                onChange={(e) => setFilterMaxSize(e.target.value)}
                                placeholder="e.g., 5GB"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Format</InputLabel>
                                <Select
                                    value={filterFormat}
                                    label="Format"
                                    onChange={(e) => setFilterFormat(e.target.value)}
                                >
                                    <MenuItem value="">All Formats</MenuItem>
                                    {[...stats.formats].map(format => (
                                        <MenuItem key={format} value={format}>{format}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Language</InputLabel>
                                <Select
                                    value={filterLanguage}
                                    label="Language"
                                    onChange={(e) => setFilterLanguage(e.target.value)}
                                >
                                    <MenuItem value="">All Languages</MenuItem>
                                    <MenuItem value="hi">Hindi</MenuItem>
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="ta">Tamil</MenuItem>
                                    <MenuItem value="te">Telugu</MenuItem>
                                    <MenuItem value="kn">Kannada</MenuItem>
                                    <MenuItem value="ml">Malayalam</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>
            </Collapse>

            {/* Selected Files Actions */}
            {selectedFiles.length > 0 && (
                <Paper 
                    elevation={0}
                    sx={{ 
                        mt: 2, 
                        p: 1.5, 
                        bgcolor: theme.palette.action.selected,
                        borderRadius: 1
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="body2">
                            <strong>{selectedFiles.length}</strong> file(s) selected
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDialogOpen('delete')}
                                color="error"
                                variant="outlined"
                            >
                                Delete Selected
                            </Button>
                            <Button
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={() => setSelectedFiles([])}
                                variant="text"
                            >
                                Clear Selection
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            )}
        </Paper>
    );
};

export default MediaSearchFilters;