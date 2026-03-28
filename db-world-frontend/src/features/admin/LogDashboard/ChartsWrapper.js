import React from 'react';
import {
  Grid,
  Box,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28EFF'];

const ChartCard = React.memo(({ title, children, width = 300, height = 300 }) => (
  <Card 
    sx={{ 
      height: '100%', 
      display: 'flex',
      flexDirection: 'column',
      minHeight: height,
      minWidth: width
    }}
  >
    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 600 }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {children}
      </Box>
    </CardContent>
  </Card>
));

const ChartsWrapper = ({ chartData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Memoized chart components to prevent unnecessary re-renders
  const LevelDistributionChart = React.useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData.levelDistribution}
          dataKey="value"
          outerRadius={isMobile ? 60 : 80}
          label={({ name, percent }) => 
            isMobile ? '' : `${name}: ${(percent * 100).toFixed(0)}%`
          }
        >
          {chartData.levelDistribution.map((entry, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, 'Count']} />
        {!isMobile && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  ), [chartData.levelDistribution, isMobile]);

  const LogsOverTimeChart = React.useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData.logsOverTime}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="time" 
          angle={isMobile ? -45 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 60 : 40}
          fontSize={12}
        />
        <YAxis fontSize={12} />
        <Tooltip />
        {!isMobile && <Legend />}
        <Line 
          type="monotone" 
          dataKey="count" 
          stroke="#8884d8" 
          strokeWidth={2}
          dot={!isMobile}
        />
      </LineChart>
    </ResponsiveContainer>
  ), [chartData.logsOverTime, isMobile]);

  const HttpMethodsChart = React.useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={Object.entries(chartData.requestStats.methods).map(([method, count]) => ({ method, count }))}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="method" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Bar dataKey="count" fill="#00C49F" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ), [chartData.requestStats.methods]);

  const StatusCodesChart = React.useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={Object.entries(chartData.requestStats.statusCodes).map(([status, count]) => ({ status, count }))}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="status" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Bar dataKey="count" fill="#FF8042" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ), [chartData.requestStats.statusCodes]);

  const TopUrisChart = React.useMemo(() => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={Object.entries(chartData.requestStats.uris)
          .sort((a, b) => b[1] - a[1])
          .slice(0, isMobile ? 5 : 8)
          .map(([uri, count]) => ({
            uri: uri.length > (isMobile ? 12 : 20) ? `${uri.substring(0, isMobile ? 12 : 20)}...` : uri,
            count,
            fullUri: uri,
          }))}
        layout="vertical"
        margin={{ left: isMobile ? 40 : 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" fontSize={12} />
        <YAxis 
          dataKey="uri"
          type="category"
          fontSize={12}
          width={isMobile ? 40 : 80}
        />
        <Tooltip
          formatter={(value, name, props) => [value, props.payload.fullUri]}
        />
        <Bar dataKey="count" fill="#8884d8" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  ), [chartData.requestStats.uris, isMobile]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {/* Log Level Distribution */}
        <Grid item xs={12} sm={6} md={4}>
          <ChartCard title="Log Level Distribution" height={300}>
            {LevelDistributionChart}
          </ChartCard>
        </Grid>

        {/* Logs Over Time */}
        <Grid item xs={12} sm={6} md={4}>
          <ChartCard title="Logs Over Time" height={300}>
            {LogsOverTimeChart}
          </ChartCard>
        </Grid>

        {/* HTTP Methods */}
        <Grid item xs={12} sm={6} md={4}>
          <ChartCard title="HTTP Methods" height={300}>
            {HttpMethodsChart}
          </ChartCard>
        </Grid>

        {/* Status Codes */}
        <Grid item xs={12} sm={6}>
          <ChartCard title="Status Codes" height={300}>
            {StatusCodesChart}
          </ChartCard>
        </Grid>

        {/* Top URIs */}
        <Grid item xs={12} sm={6}>
          <ChartCard title="Top URIs" height={350}>
            {TopUrisChart}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(ChartsWrapper);