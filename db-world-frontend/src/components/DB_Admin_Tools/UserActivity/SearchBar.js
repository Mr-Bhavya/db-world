import { Clear, Search } from "@mui/icons-material";
import { CircularProgress, IconButton, InputAdornment, TextField, useMediaQuery, useTheme } from "@mui/material";

const SearchBar = ({ searchTerm, onSearchChange, onSearch, onClear, loading }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <TextField
      placeholder="Search logs..."
      value={searchTerm}
      onChange={onSearchChange}
      onKeyPress={(e) => e.key === 'Enter' && onSearch()}
      sx={{ minWidth: isMobile ? '100%' : 300 }}
      disabled={loading}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {searchTerm && (
              <IconButton onClick={onClear} size="small" disabled={loading}>
                <Clear />
              </IconButton>
            )}
            <IconButton onClick={onSearch} size="small" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <Search />}
            </IconButton>
          </InputAdornment>
        )
      }}
    />
  );
};

export default SearchBar;