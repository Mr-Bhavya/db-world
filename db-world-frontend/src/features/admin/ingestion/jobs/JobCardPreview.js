import React from 'react';
import { Box, Stack } from '@mui/material';
import JobCard from './JobCard';
import { mockLiveJobs } from './mockLiveJobs';

export default function JobCardPreview() {
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        {Object.values(mockLiveJobs).map((job) => (
          <JobCard key={job.jobId} job={job} />
        ))}
      </Stack>
    </Box>
  );
}