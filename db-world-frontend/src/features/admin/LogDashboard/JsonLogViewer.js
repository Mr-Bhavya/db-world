import { List } from "react-window";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box, Card, CardContent, Typography, Grid, Paper,
  Tabs, Tab, TextField, InputAdornment, IconButton,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Fab, CircularProgress,
  Tooltip
} from '@mui/material';

const JsonLogViewer = ({ logs, isLoading }) => {
  const theme = useTheme();

  const colorMap = {
    INFO: "#26a69a",
    WARN: "#ffb74d",
    ERROR: "#ef5350",
    DEBUG: "#80cbc4",
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: alpha(theme.palette.background.default, 0.8),
          p: 4,
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: theme.palette.text.secondary,
          p: 4,
        }}
      >
        <Typography variant="body1">No matching logs found</Typography>
      </Box>
    );
  }

  const Row = ({ index, style }) => {
    const log = logs[index];
    const level = log.level?.toUpperCase() || "INFO";
    const bg = alpha(colorMap[level] || "#00bfa5", 0.08);
    const border = alpha(colorMap[level] || "#00bfa5", 0.4);

    return (
      <Box
        style={style}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: bg,
          transition: "all 0.2s ease",
          "&:hover": {
            bgcolor: alpha(colorMap[level] || "#00bfa5", 0.15),
            transform: "translateX(2px)",
          },
        }}
      >
        <Chip
          size="small"
          label={level}
          sx={{
            mr: 1.5,
            color: "#fff",
            bgcolor: colorMap[level] || "#00bfa5",
            fontSize: "0.7rem",
            minWidth: 70,
            justifyContent: "center",
          }}
        />

        <Tooltip
          title={
            <pre
              style={{
                fontSize: 11,
                margin: 0,
                color: "#00bfa5",
                whiteSpace: "pre-wrap",
                maxWidth: 600,
              }}
            >
              {log.raw || JSON.stringify(log, null, 2)}
            </pre>
          }
          arrow
          placement="left-start"
        >
          <Box sx={{ flex: 1, overflow: "hidden" }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontFamily: "monospace", color: theme.palette.text.primary }}
            >
              {log.timestamp} — {log.message}
            </Typography>

            <Box display="flex" alignItems="center" gap={1}>
              {log.user && (
                <Typography variant="caption" color="text.secondary">
                  {`User: ${log.user}`}
                </Typography>
              )}
              {log.method && (
                <Typography variant="caption" color="text.secondary">
                  {` • ${log.method} ${log.uri || ""}`}
                </Typography>
              )}
            </Box>
          </Box>
        </Tooltip>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: { xs: 400, md: 600 },
        borderRadius: 2,
        border: `1px solid ${alpha("#00bfa5", 0.2)}`,
        fontFamily: "monospace",
        background: alpha(theme.palette.background.paper, 0.9),
      }}
    >
      <List
        height={window.innerHeight * 0.6}
        width="100%"
        itemCount={logs.length}
        itemSize={48}
        overscanCount={8}
      >
        {Row}
      </List>
    </Box>
  );
};

export default JsonLogViewer;