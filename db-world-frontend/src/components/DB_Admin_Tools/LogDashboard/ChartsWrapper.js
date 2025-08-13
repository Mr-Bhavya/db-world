import React from 'react';
import {
  Grid,
  Box,
  useMediaQuery,
  useTheme, Card, CardContent, Typography
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28EFF'];

const ChartCard = ({ title, height = 250, width = 400, children }) => (
  <Card sx={{ height: '100%', minWidth: width }}>
    <CardContent>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Box sx={{ height, width }}>
        {children}
      </Box>
    </CardContent>
  </Card>
);

const ChartsWrapper = ({ chartData }) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        width: '100%',
        // overflowX: isSmall ? 'auto' : 'visible',
        p: { xs: 1, sm: 2 },
      }}
    >
      <Box
        sx={{
          // minWidth: isSmall ? '1200px' : 'auto',
          // display: isSmall ? 'flex' : 'block',
          gap: 2,
        }}
      >
        <Grid
          container
          spacing={2}
          sx={{ flexWrap: 'wrap' }}
        >
          {/* Log Level Distribution */}
          <Grid item xs={12} sm={6} md={4}>
            <ChartCard title="Log Level Distribution" height={280} width={380}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.levelDistribution}
                    dataKey="value"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.levelDistribution.map((entry, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>

          {/* Logs Over Time */}
          <Grid item xs={12} sm={6} md={4}>
            <ChartCard title="Logs Over Time" height={250} width={480}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.logsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>

          {/* HTTP Methods */}
          <Grid item xs={12} sm={6} md={4}>
            <ChartCard title="HTTP Methods" height={250} width={280}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(chartData.requestStats.methods).map(([method, count]) => ({ method, count }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>

          {/* Status Codes */}
          <Grid item xs={12} sm={6}>
            <ChartCard title="Status Codes" height={250} width={380}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(chartData.requestStats.statusCodes).map(([status, count]) => ({ status, count }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>

          {/* Top URIs */}
          <Grid item xs={12} sm={6}>
            <ChartCard title="Top URIs" height={300} width={680}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(chartData.requestStats.uris)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([uri, count]) => ({
                      uri: uri.length > 15 ? `${uri.substring(0, 15)}...` : uri,
                      count,
                      fullUri: uri,
                    }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="uri"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    labelFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                    formatter={(value, name, props) => [value, props.payload.fullUri]}
                  />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default ChartsWrapper;
