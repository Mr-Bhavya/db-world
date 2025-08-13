import { Card, CardContent, Box, Avatar, Typography } from '@mui/material';

export const StatCard = ({ title, value, icon, color = 'primary.main', secondary }) => {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center">
          <Avatar sx={{ bgcolor: color, mr: 2 }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h5">{value}</Typography>
            <Typography variant="body2">{title}</Typography>
            {secondary && (
              <Typography variant="caption" color="text.secondary">
                {secondary}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};