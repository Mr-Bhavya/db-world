// src/components/dashboard/Dashboard.js
import React from 'react';
import { Row, Col, Card, Statistic, Progress, Alert, Table, Tag } from 'antd';
import { 
  DashboardOutlined, 
  AlertOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';
import './Dashboard.css';

const Dashboard = ({ serverInfo }) => {
  if (!serverInfo) return null;

  const { health, cpu, memory, disk, network, osName } = serverInfo;
  
  const getHealthColor = (status) => {
    switch (status) {
      case 'EXCELLENT': return 'green';
      case 'GOOD': return 'blue';
      case 'FAIR': return 'orange';
      case 'POOR': return 'red';
      case 'CRITICAL': return 'darkred';
      default: return 'gray';
    }
  };

  const columns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getHealthColor(status)}>{status}</Tag>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      metric: 'CPU Usage',
      value: cpu?.usagePercent ? `${cpu.usagePercent}%` : 'N/A',
      status: cpu?.usagePercent > 90 ? 'POOR' : cpu?.usagePercent > 80 ? 'FAIR' : 'GOOD',
    },
    {
      key: '2',
      metric: 'Memory Usage',
      value: memory?.usedPercent ? `${memory.usedPercent}%` : 'N/A',
      status: memory?.usedPercent > 90 ? 'POOR' : memory?.usedPercent > 80 ? 'FAIR' : 'GOOD',
    },
    {
      key: '3',
      metric: 'Disk Usage',
      value: disk?.rootUsagePercent ? `${disk.rootUsagePercent}%` : 'N/A',
      status: disk?.rootUsagePercent > 90 ? 'POOR' : disk?.rootUsagePercent > 80 ? 'FAIR' : 'GOOD',
    },
  ];

  return (
    <div className="dashboard">
      {/* Health Status Card */}
      <Card title="System Health Status" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Overall Score"
              value={health?.score || 0}
              suffix="/100"
              valueStyle={{ color: getHealthColor(health?.status) }}
              prefix={<DashboardOutlined />}
            />
            <Progress 
              percent={health?.score || 0} 
              status={health?.score > 80 ? 'success' : health?.score > 60 ? 'normal' : 'exception'}
              style={{ marginTop: 8 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Status"
              value={health?.status || 'UNKNOWN'}
              valueStyle={{ color: getHealthColor(health?.status) }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Warnings"
              value={health?.warnings?.length || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: health?.warnings?.length > 0 ? '#faad14' : '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Uptime"
              value={serverInfo.uptime || 'N/A'}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
        </Row>
        
        {health?.warnings && health.warnings.length > 0 && (
          <Alert
            message="System Warnings"
            description={
              <ul style={{ margin: 0 }}>
                {health.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Resource Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="CPU">
            <Progress 
              type="dashboard" 
              percent={cpu?.usagePercent || 0} 
              strokeColor={cpu?.usagePercent > 90 ? '#f5222d' : cpu?.usagePercent > 80 ? '#faad14' : '#52c41a'}
            />
            <div style={{ marginTop: 16 }}>
              <p><strong>Cores:</strong> {cpu?.cores || 'N/A'}</p>
              <p><strong>Model:</strong> {cpu?.model || 'N/A'}</p>
              <p><strong>Frequency:</strong> {cpu?.frequency || 'N/A'}</p>
            </div>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card title="Memory">
            <Progress 
              type="dashboard" 
              percent={memory?.usedPercent || 0} 
              strokeColor={memory?.usedPercent > 90 ? '#f5222d' : memory?.usedPercent > 80 ? '#faad14' : '#52c41a'}
            />
            <div style={{ marginTop: 16 }}>
              <p><strong>Used:</strong> {memory?.usedFormatted || 'N/A'}</p>
              <p><strong>Total:</strong> {memory?.totalFormatted || 'N/A'}</p>
              <p><strong>Available:</strong> {memory?.availableFormatted || 'N/A'}</p>
            </div>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card title="Disk">
            <Progress 
              type="dashboard" 
              percent={disk?.rootUsagePercent || 0} 
              strokeColor={disk?.rootUsagePercent > 90 ? '#f5222d' : disk?.rootUsagePercent > 80 ? '#faad14' : '#52c41a'}
            />
            <div style={{ marginTop: 16 }}>
              <p><strong>Used:</strong> {disk?.usedFormatted || 'N/A'}</p>
              <p><strong>Total:</strong> {disk?.totalFormatted || 'N/A'}</p>
              <p><strong>Free:</strong> {disk?.freeFormatted || 'N/A'}</p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* System Metrics Table */}
      <Card title="System Metrics">
        <Table 
          columns={columns} 
          dataSource={data} 
          pagination={false}
          size="small"
        />
      </Card>

      {/* Quick Actions */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Quick Actions">
            <Row gutter={16}>
              <Col span={6}>
                <Card hoverable size="small" onClick={() => window.location.href = '/performance'}>
                  <div style={{ textAlign: 'center' }}>
                    <LineChartOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <p style={{ marginTop: 8 }}>Performance Charts</p>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable size="small" onClick={() => window.location.href = '/processes'}>
                  <div style={{ textAlign: 'center' }}>
                    <CloudServerOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                    <p style={{ marginTop: 8 }}>Process Manager</p>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable size="small" onClick={() => window.location.href = '/network'}>
                  <div style={{ textAlign: 'center' }}>
                    <WifiOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                    <p style={{ marginTop: 8 }}>Network Stats</p>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card hoverable size="small" onClick={() => window.location.href = '/settings'}>
                  <div style={{ textAlign: 'center' }}>
                    <SettingOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                    <p style={{ marginTop: 8 }}>Settings</p>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;