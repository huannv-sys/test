/**
 * Dashboard functionality
 * Handles the main dashboard view and metrics display
 */

// Chart instances
let cpuChart = null;
let clientChart = null;

// Default options
const defaultOptions = {
    cpuTimeRange: 24, // hours
    clientTimeRange: 24 // hours
};

/**
 * Initialize the dashboard
 */
async function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // Set up event listeners
    document.getElementById('refresh-dashboard').addEventListener('click', function() {
        refreshDashboard();
    });
    
    // Set up time range selectors for CPU chart
    document.querySelectorAll('.cpu-time-range').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const hours = parseInt(this.dataset.hours);
            defaultOptions.cpuTimeRange = hours;
            refreshDashboard();
        });
    });
    
    // Set up time range selectors for client chart
    document.querySelectorAll('.client-time-range').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const hours = parseInt(this.dataset.hours);
            defaultOptions.clientTimeRange = hours;
            refreshDashboard();
        });
    });
    
    // Initial data load
    refreshDashboard();
    
    // Set up auto-refresh
    setInterval(refreshDashboard, 60000); // Refresh every minute
}

/**
 * Refresh the dashboard data
 */
async function refreshDashboard() {
    console.log('Refreshing dashboard data...');
    showLoading();
    
    try {
        const apiClient = new ApiClient();
        const dashboardData = await apiClient.getDashboardData();
        
        // Update device statistics
        updateDeviceStats(dashboardData.device_stats);
        
        // Update CPU usage chart
        if (dashboardData.cpu_data) {
            if (!cpuChart) {
                createCPUChart(dashboardData.cpu_data);
            } else {
                updateCPUChart(dashboardData.cpu_data);
            }
        }
        
        // Update client count chart
        if (dashboardData.client_data) {
            if (!clientChart) {
                createClientChart(dashboardData.client_data);
            } else {
                updateClientChart(dashboardData.client_data);
            }
        }
        
        // Update device status table
        updateDeviceStatusTable(dashboardData.devices);
        
        // Update recent alerts
        updateRecentAlerts(dashboardData.recent_alerts);
        
        hideLoading();
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
        showError('Không thể tải dữ liệu dashboard. Vui lòng thử lại sau.');
        hideLoading();
    }
}

/**
 * Update device statistics
 * @param {object} deviceStats - Device statistics
 */
function updateDeviceStats(deviceStats) {
    document.getElementById('devices-count').textContent = deviceStats.total || 0;
    document.getElementById('alerts-total').textContent = deviceStats.alerts || 0;
    document.getElementById('uptime-avg').textContent = deviceStats.avg_uptime || '--';
    document.getElementById('clients-total').textContent = deviceStats.total_clients || 0;
}

/**
 * Update device status table
 * @param {array} devices - Device list
 */
function updateDeviceStatusTable(devices) {
    const tableBody = document.getElementById('device-status-table').querySelector('tbody');
    
    if (!devices || devices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có thiết bị nào</td>
            </tr>
        `;
        return;
    }
    
    // Sort devices by status (online first)
    devices.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return a.name.localeCompare(b.name);
    });
    
    let html = '';
    
    devices.forEach(device => {
        const statusClass = device.status === 'online' ? 'status-active' : 'status-inactive';
        const cpuUsage = device.cpu_load !== undefined ? `${device.cpu_load}%` : '--';
        const memoryUsage = device.memory_usage !== undefined ? `${device.memory_usage}%` : '--';
        
        html += `
            <tr>
                <td>
                    <a href="/devices?device=${device.id}" class="fw-bold">${device.name}</a>
                </td>
                <td>${device.ip_address}</td>
                <td>
                    <span class="status-circle ${statusClass}"></span>
                    ${device.status === 'online' ? 'Online' : 'Offline'}
                </td>
                <td>${cpuUsage}</td>
                <td>${memoryUsage}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

/**
 * Create CPU usage chart
 * @param {array} cpuData - CPU usage data
 */
function createCPUChart(cpuData) {
    const ctx = document.getElementById('cpuChart').getContext('2d');
    
    // Process data
    const labels = [];
    const datasets = {};
    
    // Group data by device
    cpuData.forEach(item => {
        const deviceName = item.device_name || `Device #${item.device_id}`;
        
        if (!datasets[deviceName]) {
            datasets[deviceName] = {
                label: deviceName,
                data: [],
                borderColor: getRandomColor(),
                backgroundColor: 'transparent',
                tension: 0.4
            };
        }
        
        // Add timestamp to labels if not exists
        const timestamp = new Date(item.timestamp).toLocaleTimeString();
        if (!labels.includes(timestamp)) {
            labels.push(timestamp);
        }
        
        // Add data point
        datasets[deviceName].data.push({
            x: new Date(item.timestamp),
            y: item.value
        });
    });
    
    // Convert datasets object to array
    const datasetArray = Object.values(datasets);
    
    // Create chart
    cpuChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasetArray
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        tooltipFormat: 'HH:mm:ss'
                    },
                    title: {
                        display: true,
                        text: 'Thời gian'
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'CPU Usage (%)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });
    
    // Hide loading indicator
    document.getElementById('cpu-loading').style.display = 'none';
}

/**
 * Update CPU usage chart
 * @param {array} cpuData - CPU usage data
 */
function updateCPUChart(cpuData) {
    if (!cpuChart) {
        createCPUChart(cpuData);
        return;
    }
    
    // Process data
    const datasets = {};
    
    // Group data by device
    cpuData.forEach(item => {
        const deviceName = item.device_name || `Device #${item.device_id}`;
        
        if (!datasets[deviceName]) {
            // Check if dataset already exists in chart
            const existingDataset = cpuChart.data.datasets.find(ds => ds.label === deviceName);
            
            datasets[deviceName] = {
                label: deviceName,
                data: [],
                borderColor: existingDataset ? existingDataset.borderColor : getRandomColor(),
                backgroundColor: 'transparent',
                tension: 0.4
            };
        }
        
        // Add data point
        datasets[deviceName].data.push({
            x: new Date(item.timestamp),
            y: item.value
        });
    });
    
    // Convert datasets object to array
    const datasetArray = Object.values(datasets);
    
    // Update chart data
    cpuChart.data.datasets = datasetArray;
    cpuChart.update();
}

/**
 * Create client count chart
 * @param {array} clientData - Client count data
 */
function createClientChart(clientData) {
    const ctx = document.getElementById('clientChart').getContext('2d');
    
    // Process data
    const labels = [];
    const datasets = {};
    
    // Group data by device
    clientData.forEach(item => {
        const deviceName = item.device_name || `Device #${item.device_id}`;
        
        if (!datasets[deviceName]) {
            datasets[deviceName] = {
                label: deviceName,
                data: [],
                borderColor: getRandomColor(),
                backgroundColor: 'transparent',
                tension: 0.4
            };
        }
        
        // Add timestamp to labels if not exists
        const timestamp = new Date(item.timestamp).toLocaleTimeString();
        if (!labels.includes(timestamp)) {
            labels.push(timestamp);
        }
        
        // Add data point
        datasets[deviceName].data.push({
            x: new Date(item.timestamp),
            y: item.value
        });
    });
    
    // Convert datasets object to array
    const datasetArray = Object.values(datasets);
    
    // Create chart
    clientChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasetArray
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        tooltipFormat: 'HH:mm:ss'
                    },
                    title: {
                        display: true,
                        text: 'Thời gian'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Số lượng kết nối'
                    },
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });
    
    // Hide loading indicator
    document.getElementById('client-loading').style.display = 'none';
}

/**
 * Update client count chart
 * @param {array} clientData - Client count data
 */
function updateClientChart(clientData) {
    if (!clientChart) {
        createClientChart(clientData);
        return;
    }
    
    // Process data
    const datasets = {};
    
    // Group data by device
    clientData.forEach(item => {
        const deviceName = item.device_name || `Device #${item.device_id}`;
        
        if (!datasets[deviceName]) {
            // Check if dataset already exists in chart
            const existingDataset = clientChart.data.datasets.find(ds => ds.label === deviceName);
            
            datasets[deviceName] = {
                label: deviceName,
                data: [],
                borderColor: existingDataset ? existingDataset.borderColor : getRandomColor(),
                backgroundColor: 'transparent',
                tension: 0.4
            };
        }
        
        // Add data point
        datasets[deviceName].data.push({
            x: new Date(item.timestamp),
            y: item.value
        });
    });
    
    // Convert datasets object to array
    const datasetArray = Object.values(datasets);
    
    // Update chart data
    clientChart.data.datasets = datasetArray;
    clientChart.update();
}

/**
 * Update recent alerts section
 * @param {array} alerts - Recent alerts
 */
function updateRecentAlerts(alerts) {
    const tableBody = document.getElementById('recent-alerts-table').querySelector('tbody');
    
    if (!alerts || alerts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có cảnh báo gần đây</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    alerts.forEach(alert => {
        const timestamp = new Date(alert.timestamp);
        const deviceName = alert.device_name || `Device #${alert.device_id}`;
        const statusClass = getStatusBadgeClass(alert.acknowledged ? 'acknowledged' : 'new');
        const statusText = formatAlertStatus(alert.acknowledged ? 'acknowledged' : 'new');
        
        html += `
            <tr>
                <td title="${formatDateTime(timestamp)}">${formatTimeAgo(timestamp)}</td>
                <td>${deviceName}</td>
                <td>${alert.metric}</td>
                <td>${alert.value} ${alert.condition} ${alert.threshold}</td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

/**
 * Helper function to get alert class based on status
 * @param {string} status - Alert status
 * @returns {string} - CSS class
 */
function getAlertClass(status) {
    switch (status) {
        case 'acknowledged':
            return 'alert-success';
        case 'resolved':
            return 'alert-info';
        case 'new':
            return 'alert-danger';
        default:
            return 'alert-warning';
    }
}

/**
 * Helper function to get badge class for alert status
 * @param {string} status - Alert status
 * @returns {string} - CSS class
 */
function getStatusBadgeClass(status) {
    switch (status) {
        case 'acknowledged':
            return 'bg-success';
        case 'resolved':
            return 'bg-info';
        case 'new':
            return 'bg-danger';
        default:
            return 'bg-warning';
    }
}

/**
 * Format alert status for display
 * @param {string} status - Alert status
 * @returns {string} - Formatted status
 */
function formatAlertStatus(status) {
    switch (status) {
        case 'acknowledged':
            return 'Đã xem';
        case 'resolved':
            return 'Đã xử lý';
        case 'new':
            return 'Mới';
        default:
            return status;
    }
}

/**
 * Generate a random color for charts
 * @returns {string} - Random color
 */
function getRandomColor() {
    const colors = [
        '#0dcaf0', // info
        '#6f42c1', // purple
        '#fd7e14', // orange
        '#20c997', // teal
        '#d63384', // pink
        '#ffc107', // warning
        '#0d6efd', // primary
        '#6c757d', // secondary
        '#198754', // success
        '#dc3545'  // danger
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Format relative time (time ago)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted time ago
 */
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    if (minutes > 0) return `${minutes} phút trước`;
    return `${seconds} giây trước`;
}

/**
 * Show loading indicators
 */
function showLoading() {
    document.getElementById('cpu-loading').style.display = 'block';
    document.getElementById('client-loading').style.display = 'block';
}

/**
 * Hide loading indicators
 */
function hideLoading() {
    document.getElementById('cpu-loading').style.display = 'none';
    document.getElementById('client-loading').style.display = 'none';
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    toast.showError(message);
}

/**
 * Helper function to format traffic
 */
function formatTraffic(bitsPerSecond) {
    if (bitsPerSecond === 0) return '0 bps';
    
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});