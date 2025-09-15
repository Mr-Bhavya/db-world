import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Person,
  Schedule,
  Public,
  Devices,
  ExpandMore,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const LogItem = React.forwardRef(({ log, isLast }, ref) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'GET': return 'primary';
      case 'POST': return 'success';
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      case 'PATCH': return 'info';
      default: return 'default';
    }
  };

  const parseUserAgent = (userAgent) => {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Android')) {
      return 'Android Device';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      return 'iOS Device';
    } else if (userAgent.includes('Windows')) {
      return 'Windows PC';
    } else if (userAgent.includes('Mac')) {
      return 'Mac';
    } else if (userAgent.includes('Linux')) {
      return 'Linux PC';
    } else {
      return 'Unknown Device';
    }
  };

  const tryParseJson = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  };

  const formatRequestBody = (body) => {
    if (!body) return null;
    
    const parsed = tryParseJson(body);
    if (typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
    return body;
  };

  const logItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      variants={logItemVariants}
      initial="hidden"
      animate="visible"
      layout
      ref={isLast ? ref : null}
    >
      <Card 
        sx={{ 
          overflow: 'visible',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4]
          }
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={log.method} 
                color={getMethodColor(log.method)} 
                size="small" 
                variant="outlined"
              />
              <Chip 
                label={log.status} 
                color={getStatusColor(log.status)} 
                size="small" 
              />
              <Chip 
                icon={<Schedule />}
                label={`${log.duration}ms`} 
                size="small" 
                variant="outlined"
              />
            </Box>
            
            <Typography variant="caption" color="textSecondary">
              {formatTimestamp(log.timestamp)}
            </Typography>
          </Box>
          
          <Typography variant="h6" component="h2" sx={{ wordBreak: 'break-all', mb: 1.5 }}>
            {log.uri}
            {log.query && (
              <Typography component="span" variant="body2" color="textSecondary">
                {log.query}
              </Typography>
            )}
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Chip
              icon={<Person />}
              label={log.username || 'Anonymous'}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<Public />}
              label={log.ip}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={<Devices />}
              label={parseUserAgent(log.userAgent)}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {(log.method === 'POST' || log.method === 'PUT' || log.method === 'PATCH') && log.requestBody && (
            <Accordion 
              expanded={expanded} 
              onChange={() => setExpanded(!expanded)}
              sx={{ mt: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="body2">Request Body</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre style={{ 
                  margin: 0, 
                  fontSize: '0.8rem', 
                  overflow: 'auto', 
                  maxHeight: '200px',
                  backgroundColor: theme.palette.grey[100],
                  padding: theme.spacing(1),
                  borderRadius: theme.shape.borderRadius
                }}>
                  {formatRequestBody(log.requestBody)}
                </pre>
              </AccordionDetails>
            </Accordion>
          )}
          
          {log.userAgent && (
            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mt: 1 }}>
              {log.userAgent}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

export default LogItem;