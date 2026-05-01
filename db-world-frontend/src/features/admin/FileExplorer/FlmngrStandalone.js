import React, { useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  useTheme,
  useMediaQuery
} from "@mui/material";
import { FlmngrPanel } from "@flmngr/flmngr-react";

const FLMNGR_API_KEY = import.meta.env.VITE_FLMNGR_API_KEY || 'abPhHyhIfD0gNqWnymrtCPeS';

export default function FlmngrStandalone() {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [error, setError] = useState(null);

  /* -------------------------------------------------
     Flmngr configuration (theme-safe & responsive)
  ------------------------------------------------- */
  const flmngrOptions = useMemo(() => {
    const compact = isMobile || isTablet;

    return {
      ui: {
        showBreadcrumb: !isMobile,
        showTree: !compact,
        showToolbar: true,
        showSearch: !isMobile,
        toolbarCompact: compact,
        viewMode: compact ? "grid" : "list"
      },

      onError: (err) => {
        console.error("Flmngr error:", err);
        setError(err?.message || "Failed to load file manager");
      }
    };
  }, [isMobile, isTablet]);

  /* -------------------------------------------------
     Error state
  ------------------------------------------------- */
  if (error) {
    return (
      <Box
        sx={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          bgcolor: "background.default"
        }}
      >
        <Box textAlign="center">
          <Typography variant="h6" color="error" gutterBottom>
            File Manager Error
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
          <Button sx={{ mt: 2 }} onClick={() => window.location.reload()}>
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  /* -------------------------------------------------
     Layout
  ------------------------------------------------- */
  return (
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "auto"
      }}
    >
    
      <Container
        maxWidth={isMobile ? false : "xl"}
        disableGutters={isMobile}
        sx={{
          flex: 1,
          py: isMobile ? 0 : 3,
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}
      >

        {/* Scroll-safe File Manager container */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              bgcolor: "background.paper",
              color: "black",
              borderRadius: isMobile ? 0 : 2,
              border: isMobile
                ? "none"
                : `1px solid ${theme.palette.divider}`,
              overflow: "auto"
            }}
          >
            <FlmngrPanel
              apiKey={FLMNGR_API_KEY}
              options={flmngrOptions}
            />
          </Box>
        </Box>

        {/* Mobile hint */}
        {isMobile && (
          <Box
            sx={{
              p: 1.5,
              textAlign: "center",
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: "background.paper"
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Tap folders to browse • Long-press for actions
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}

FlmngrStandalone.displayName = "FlmngrStandalone";