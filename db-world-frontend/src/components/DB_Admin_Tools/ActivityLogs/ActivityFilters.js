import React, { useState, useEffect, useCallback } from "react";
import {
    Box,
    TextField,
    MenuItem,
    Button,
    Chip,
    Collapse,
    IconButton,
    Paper,
    InputAdornment,
    Typography,
    Autocomplete,
    CircularProgress,
    useTheme,
    useMediaQuery,
    Stack,
} from "@mui/material";
import {
    FilterList as FilterListIcon,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Person as PersonIcon,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { fetchUsernames } from "./activityLogsService";

// 🌈 Styled components
const FilterContainer = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(3),
    background: theme.palette.mode === "dark"
        ? "linear-gradient(145deg, #1e1e1e, #2a2a2a)"
        : "linear-gradient(145deg, #f5f7ff, #ffffff)",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    boxShadow: theme.shadows[2],
    transition: "all 0.3s ease",
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        transition: "all 0.3s ease",
        "&:hover": {
            boxShadow: `0 0 0 2px ${theme.palette.primary.light}40`,
        },
        "&.Mui-focused": {
            boxShadow: `0 0 0 2px ${theme.palette.primary.main}40`,
        },
    },
}));

const FilterChip = styled(Chip)(({ theme }) => ({
    margin: theme.spacing(0.5),
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.8rem",
    "&.method-get": {
        backgroundColor: "#e8f5e8",
        color: "#2e7d32",
    },
    "&.method-post": {
        backgroundColor: "#e3f2fd",
        color: "#1565c0",
    },
    "&.method-put": {
        backgroundColor: "#fff3e0",
        color: "#ef6c00",
    },
    "&.method-delete": {
        backgroundColor: "#ffebee",
        color: "#c62828",
    },
    "&.status-success": {
        backgroundColor: "#e8f5e8",
        color: "#2e7d32",
    },
    "&.status-error": {
        backgroundColor: "#ffebee",
        color: "#c62828",
    },
    "&.status-warning": {
        backgroundColor: "#fff3e0",
        color: "#ef6c00",
    },
}));

const ActivityFilters = ({ filters, onFilterChange, onClearFilters }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

    const [usernames, setUsernames] = useState([]);
    const [loadingUsernames, setLoadingUsernames] = useState(false);
    const [usernameInput, setUsernameInput] = useState("");
    const [expanded, setExpanded] = useState(!isMobile);

    // Adjust expand/collapse dynamically on screen resize
    useEffect(() => setExpanded(!isMobile), [isMobile]);

    const methodOptions = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH"
    ].map(v => ({ value: v, label: v }));

    const statusOptions = [
        { value: "200", label: "200 - Success" },
        { value: "201", label: "201 - Created" },
        { value: "400", label: "400 - Bad Request" },
        { value: "401", label: "401 - Unauthorized" },
        { value: "403", label: "403 - Forbidden" },
        { value: "404", label: "404 - Not Found" },
        { value: "500", label: "500 - Server Error" },
    ];

    // Fetch usernames with debounce
    const fetchUsernameOptions = useCallback(async (query = "") => {
        setLoadingUsernames(true);
        try {
            const response = await fetchUsernames(query);
            const userData = response.data?.content || response.data?.data || response.data || [];
            const formatted = userData.map((u) => ({
                label: u.fullName ? `${u.fullName} (${u.email || u.username})` : (u.email || u.username),
                value: u.email || u.username,
                userObject: u,
            }));
            setUsernames(formatted);
        } catch (e) {
            console.error("Failed to fetch usernames", e);
            setUsernames([]);
        } finally {
            setLoadingUsernames(false);
        }
    }, []);

    useEffect(() => {
        if (usernameInput.length < 2) return;
        const delay = setTimeout(() => fetchUsernameOptions(usernameInput), 400);
        return () => clearTimeout(delay);
    }, [usernameInput, fetchUsernameOptions]);

    const handleFilterChange = (field, value) =>
        onFilterChange({ ...filters, [field]: value });

    const handleUsernameChange = (_, newValue) => {
        if (newValue) setUsernameInput("");
        handleFilterChange("username", newValue ? newValue.value : "");
    };

    const handleUsernameInputChange = (_, newValue) => setUsernameInput(newValue);

    const hasActiveFilters = Object.values(filters).some((v) => v);

    const getStatusClass = (code) => {
        const s = parseInt(code);
        if (s >= 200 && s < 300) return "status-success";
        if (s >= 400 && s < 500) return "status-warning";
        if (s >= 500) return "status-error";
        return "";
    };

    const selectedUsername =
        usernames.find((u) => u.value === filters.username) || null;

    return (
        <FilterContainer>
            {/* Header */}
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                flexDirection={{ xs: "column", sm: "row" }}
                gap={{ xs: 2, sm: 1, md: 0 }}
                sx={{ mb: 2 }}
                width="100%"
            >
                {/* Left Section - Title with Filter Icon */}
                <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    width={{ xs: "100%", sm: "auto" }}
                    justifyContent={{ xs: "space-between", sm: "flex-start" }}
                >
                    <Box display="flex" alignItems="center" gap={1}>
                        <FilterListIcon color="primary" />
                        <Typography
                            variant="h6"
                            fontWeight={600}
                            fontSize={{ xs: "1.1rem", sm: "1.25rem" }}
                        >
                            Filters
                        </Typography>
                    </Box>

                    {/* Active Chip - Mobile position */}
                    {hasActiveFilters && (
                        <Chip
                            label="Active"
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{
                                display: { xs: "flex", sm: "none" }
                            }}
                        />
                    )}

                    {/* Active Chip - Desktop position */}
                    {hasActiveFilters && (
                        <Chip
                            label="Active"
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{
                                display: { xs: "none", sm: "flex" }
                            }}
                        />
                    )}
                </Box>

                {/* Right Section - Actions */}
                <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    width={{ xs: "100%", sm: "auto" }}
                    justifyContent={{ xs: "space-between", sm: "flex-end" }}
                >
                    {/* Expand/Collapse Button - Mobile only */}
                    <IconButton
                        size="small"
                        color={expanded ? "primary" : "default"}
                        onClick={() => setExpanded(!expanded)}
                        sx={{
                            display: { xs: "flex", md: "none" },
                            order: { xs: 2, sm: 1 }
                        }}
                    >
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>

                    {/* Clear Filters Button */}
                    <Button
                        variant="outlined"
                        color="secondary"
                        startIcon={<ClearIcon />}
                        onClick={() => {
                            onClearFilters();
                            setUsernameInput("");
                        }}
                        disabled={!hasActiveFilters}
                        size={isMobile ? "medium" : "small"}
                        sx={{
                            minWidth: { xs: "140px", sm: "auto" },
                            flex: { xs: 1, sm: "none" },
                            order: { xs: 1, sm: 2 }
                        }}
                    >
                        {isMobile ? "Clear All" : "Clear"}
                    </Button>
                </Box>
            </Box>

            {/* Filter Inputs */}
            <Collapse in={expanded}>
                <Stack
                    direction={isTablet || isMobile ? "column" : "row"}
                    spacing={2}
                    justifyContent="space-between"
                >
                    {/* Method */}
                    <StyledTextField
                        select
                        fullWidth
                        label="HTTP Method"
                        value={filters.method}
                        onChange={(e) => handleFilterChange("method", e.target.value)}
                    >
                        <MenuItem value="">All Methods</MenuItem>
                        {methodOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </StyledTextField>

                    {/* Status */}
                    <StyledTextField
                        select
                        fullWidth
                        label="Status Code"
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                    >
                        <MenuItem value="">All Statuses</MenuItem>
                        {statusOptions.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </MenuItem>
                        ))}
                    </StyledTextField>

                    {/* Username */}
                    <Autocomplete
                        options={usernames}
                        value={selectedUsername}
                        onChange={handleUsernameChange}
                        onInputChange={handleUsernameInputChange}
                        loading={loadingUsernames}
                        getOptionLabel={(opt) => opt.label}
                        isOptionEqualToValue={(opt, val) => opt.value === val.value}
                        fullWidth
                        renderInput={(params) => (
                            <StyledTextField
                                {...params}
                                label="Search User"
                                placeholder="Type to search..."
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <>
                                            <InputAdornment position="start">
                                                <PersonIcon color="action" />
                                            </InputAdornment>
                                            {params.InputProps.startAdornment}
                                        </>
                                    ),
                                    endAdornment: (
                                        <>
                                            {loadingUsernames && (
                                                <CircularProgress color="inherit" size={20} />
                                            )}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText={
                            usernameInput.length < 2
                                ? "Type at least 2 characters"
                                : "No users found"
                        }
                    />
                </Stack>
            </Collapse>

            {/* Active Filters */}
            {hasActiveFilters && (
                <Box mt={2}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                        sx={{ fontWeight: 500 }}
                    >
                        Active Filters:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                        {filters.method && (
                            <FilterChip
                                label={`Method: ${filters.method}`}
                                onDelete={() => handleFilterChange("method", "")}
                                className={`method-${filters.method.toLowerCase()}`}
                            />
                        )}
                        {filters.status && (
                            <FilterChip
                                label={`Status: ${filters.status}`}
                                onDelete={() => handleFilterChange("status", "")}
                                className={getStatusClass(filters.status)}
                            />
                        )}
                        {filters.username && (
                            <FilterChip
                                label={`User: ${filters.username}`}
                                onDelete={() => handleFilterChange("username", "")}
                            />
                        )}
                    </Box>
                </Box>
            )}
        </FilterContainer>
    );
};

export default ActivityFilters;
