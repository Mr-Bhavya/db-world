import React, { useState } from 'react';
import { 
  ListItem, ListItemAvatar, Avatar, ListItemText, List, 
  Box
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  Download as DownloadIcon,
  PlayArrow as StreamIcon,
  Storage as StorageIcon,
  Person as PersonIcon
} from '@mui/icons-material';

export const UserActivity = ({ user, activities, theme }) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getEventIcon = (event) => {
    switch (event?.toLowerCase()) {
      case 'download': return <DownloadIcon fontSize="small" color="primary" />;
      case 'stream': return <StreamIcon fontSize="small" color="success" />;
      default: return <StorageIcon fontSize="small" />;
    }
  };

  return (
    <React.Fragment key={user}>
      <ListItem button onClick={() => setExpanded(!expanded)}>
        <ListItemAvatar>
          <Avatar>
            <PersonIcon />
          </Avatar>
        </ListItemAvatar>
        <ListItemText 
          primary={user} 
          secondary={`${activities.length} activities`} 
        />
      </ListItem>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <List dense sx={{ pl: 0 }}>
            {activities.map((activity, i) => (
              <ListItem key={i}>
                <ListItemAvatar>
                  <Avatar sx={{ 
                    bgcolor: theme.palette.background.paper,
                    width: 24, 
                    height: 24,
                  }}>
                    {getEventIcon(activity.event)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={activity.value?.split('/').pop() || activity.value}
                  secondary={
                    <Box component="span">
                      {activity.event} • {formatDate(activity.time)}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </motion.div>
      )}
    </React.Fragment>
  );
};