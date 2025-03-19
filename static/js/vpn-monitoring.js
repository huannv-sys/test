/**
 * VPN Monitoring functionality
 * Handles the VPN monitoring view and visualization
 */

// Selected device for VPN monitoring
let vpnSelectedDeviceId = null;

// Chart instances
let vpnConnectionsChart = null;
let vpnTrafficChart = null;

/**
 * Initialize VPN monitoring page
 */
function initializeVpnMonitoring() {
    console.log('Initializing VPN monitoring...');
    
    // Set up event listeners
    setupVpnEventListeners();
    
    // Load devices list
    loadVpnDevices();
}

/**
 * Set up all event listeners for VPN monitoring
 */
function setupVpnEventListeners() {
    // Refresh button
    document.getElementById('refresh-vpn').addEventListener('click', function() {
        if (vpnSelectedDeviceId) {
            loadVpnData(vpnSelectedDeviceId);
        } else {
            loadVpnDevices();
        }
    });
    
    // Time range selectors for charts
    const timeRangeButtons = document.querySelectorAll('.vpn-time-range');
    timeRangeButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all buttons
            timeRangeButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get time range in hours
            const hours = parseInt(this.dataset.hours);
            
            // Reload data with new time range
            if (vpnSelectedDeviceId) {
                loadVpnData(vpnSelectedDeviceId, hours);
            }
        });
    });
}

/**
 * Load devices list for VPN monitoring
 */
async function loadVpnDevices() {
    try {
        document.getElementById('vpn-devices-loading').style.display = 'block';
        document.getElementById('vpn-devices-list').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDevices();
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải danh sách thiết bị');
        }
        
        const devicesList = document.getElementById('vpn-devices-list');
        devicesList.innerHTML = '';
        
        if (response.devices && response.devices.length > 0) {
            // Filter devices that have VPN capabilities
            const vpnDevices = response.devices.filter(device => 
                device.capabilities?.includes('vpn') || 
                device.model?.toLowerCase().includes('router') ||
                device.tags?.includes('vpn')
            );
            
            if (vpnDevices.length === 0) {
                devicesList.innerHTML = '<div class="text-center p-3 text-muted">Không tìm thấy thiết bị VPN nào</div>';
            } else {
                vpnDevices.forEach(device => {
                    const deviceElement = document.createElement('a');
                    deviceElement.href = '#';
                    deviceElement.className = `list-group-item list-group-item-action vpn-device-item ${device.status === 'online' ? '' : 'text-muted'}`;
                    deviceElement.dataset.deviceId = device.id;
                    
                    const statusClass = device.status === 'online' ? 'status-active' : 'status-inactive';
                    
                    deviceElement.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <span class="status-circle ${statusClass}"></span>
                                ${device.name}
                            </div>
                            <small>${device.ip_address}</small>
                        </div>
                    `;
                    
                    deviceElement.addEventListener('click', function(e) {
                        e.preventDefault();
                        
                        // Remove active class from all devices
                        document.querySelectorAll('.vpn-device-item').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Add active class to clicked device
                        this.classList.add('active');
                        
                        // Load VPN data for selected device
                        const deviceId = parseInt(this.dataset.deviceId);
                        vpnSelectedDeviceId = deviceId;
                        
                        // Get selected time range
                        const activeTimeRange = document.querySelector('.vpn-time-range.active');
                        const hours = activeTimeRange ? parseInt(activeTimeRange.dataset.hours) : 24;
                        
                        loadVpnData(deviceId, hours);
                    });
                    
                    devicesList.appendChild(deviceElement);
                });
            }
        } else {
            devicesList.innerHTML = '<div class="text-center p-3 text-muted">Không có thiết bị nào</div>';
        }
        
        document.getElementById('vpn-devices-loading').style.display = 'none';
        document.getElementById('vpn-devices-list').style.display = 'block';
    } catch (error) {
        console.error('Error loading VPN devices:', error);
        showError('Không thể tải danh sách thiết bị VPN');
        document.getElementById('vpn-devices-loading').style.display = 'none';
        document.getElementById('vpn-devices-list').style.display = 'block';
    }
}

/**
 * Load VPN data for selected device
 * @param {number} deviceId - Device ID
 * @param {number} hours - Time range in hours
 */
async function loadVpnData(deviceId, hours = 24) {
    try {
        resetVpnView();
        
        document.getElementById('vpn-loading').style.display = 'block';
        document.getElementById('vpn-content').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceVpnData(deviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải dữ liệu VPN');
        }
        
        // Set device name
        document.getElementById('vpn-device-name').textContent = response.device?.name || 'Thiết bị';
        
        updateVpnOverview(response.vpn);
        updateVpnConnections(response.vpn?.connections || []);
        updateVpnUsers(response.vpn?.users || []);
        
        // Get historical data if available
        if (response.history) {
            renderVpnCharts(response.history, hours);
        }
        
        document.getElementById('vpn-loading').style.display = 'none';
        document.getElementById('vpn-content').style.display = 'block';
    } catch (error) {
        console.error('Error loading VPN data:', error);
        showError('Không thể tải dữ liệu VPN');
        document.getElementById('vpn-loading').style.display = 'none';
    }
}

/**
 * Reset VPN view to default state
 */
function resetVpnView() {
    // Clear charts
    if (vpnConnectionsChart) {
        vpnConnectionsChart.destroy();
        vpnConnectionsChart = null;
    }
    
    if (vpnTrafficChart) {
        vpnTrafficChart.destroy();
        vpnTrafficChart = null;
    }
    
    // Reset tables
    document.getElementById('vpn-connections-table-body').innerHTML = '';
    document.getElementById('vpn-users-table-body').innerHTML = '';
    
    // Reset overview
    document.getElementById('vpn-active-connections').textContent = '0';
    document.getElementById('vpn-total-users').textContent = '0';
    document.getElementById('vpn-rx-traffic').textContent = '0 bps';
    document.getElementById('vpn-tx-traffic').textContent = '0 bps';
}

/**
 * Update VPN overview section
 * @param {object} vpnData - VPN data
 */
function updateVpnOverview(vpnData) {
    if (!vpnData) return;
    
    // Set overview statistics
    document.getElementById('vpn-active-connections').textContent = vpnData.active_connections || 0;
    document.getElementById('vpn-total-users').textContent = vpnData.total_users || 0;
    
    if (vpnData.traffic) {
        document.getElementById('vpn-rx-traffic').textContent = formatTraffic(vpnData.traffic.rx_bits_per_second || 0);
        document.getElementById('vpn-tx-traffic').textContent = formatTraffic(vpnData.traffic.tx_bits_per_second || 0);
    }
    
    // VPN servers status
    if (vpnData.servers) {
        const serversContainer = document.getElementById('vpn-servers-status');
        serversContainer.innerHTML = '';
        
        vpnData.servers.forEach(server => {
            const serverElement = document.createElement('div');
            serverElement.className = 'col-md-6 col-lg-4 mb-3';
            
            const statusClass = server.enabled ? 'bg-success' : 'bg-secondary';
            
            serverElement.innerHTML = `
                <div class="card border-0 bg-dark">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="card-title m-0">${server.type.toUpperCase()}</h6>
                            <span class="badge ${statusClass}">${server.enabled ? 'Đang hoạt động' : 'Tắt'}</span>
                        </div>
                        <div class="small text-muted">
                            <div>Port: ${server.port || 'N/A'}</div>
                            ${server.ip_pool ? `<div>IP Pool: ${server.ip_pool}</div>` : ''}
                            ${server.authentication ? `<div>Auth: ${server.authentication}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            serversContainer.appendChild(serverElement);
        });
    }
}

/**
 * Update VPN connections table
 * @param {array} connections - VPN connections
 */
function updateVpnConnections(connections) {
    const tableBody = document.getElementById('vpn-connections-table-body');
    tableBody.innerHTML = '';
    
    if (!connections || connections.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">Không có kết nối nào</td>
            </tr>
        `;
        return;
    }
    
    connections.forEach(conn => {
        const row = document.createElement('tr');
        
        // Calculate duration
        let duration = 'Unknown';
        if (conn.uptime) {
            // Try to parse different uptime formats
            if (typeof conn.uptime === 'string') {
                duration = conn.uptime;
            } else if (typeof conn.uptime === 'number') {
                // Assume uptime in seconds
                const days = Math.floor(conn.uptime / 86400);
                const hours = Math.floor((conn.uptime % 86400) / 3600);
                const minutes = Math.floor((conn.uptime % 3600) / 60);
                const seconds = conn.uptime % 60;
                
                if (days > 0) {
                    duration = `${days}d ${hours}h ${minutes}m`;
                } else if (hours > 0) {
                    duration = `${hours}h ${minutes}m ${seconds}s`;
                } else {
                    duration = `${minutes}m ${seconds}s`;
                }
            }
        }
        
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <span class="status-circle status-active me-2"></span>
                    ${conn.username || 'Anonymous'}
                </div>
            </td>
            <td>${conn.type || 'Unknown'}</td>
            <td>${conn.remote_address || 'N/A'}</td>
            <td>${conn.local_address || 'N/A'}</td>
            <td>${duration}</td>
            <td>${formatTraffic(conn.rx_bits_per_second || 0)}</td>
            <td>${formatTraffic(conn.tx_bits_per_second || 0)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

/**
 * Update VPN users table
 * @param {array} users - VPN users
 */
function updateVpnUsers(users) {
    const tableBody = document.getElementById('vpn-users-table-body');
    tableBody.innerHTML = '';
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có người dùng nào</td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        const statusClass = user.disabled ? 'status-inactive' : 'status-active';
        const statusText = user.disabled ? 'Vô hiệu hóa' : 'Hoạt động';
        
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <span class="status-circle ${statusClass} me-2"></span>
                    ${user.name}
                </div>
            </td>
            <td>${user.profile || 'Default'}</td>
            <td>${user.limit ? user.limit : 'Không giới hạn'}</td>
            <td>${user.last_logged_out ? formatDateTime(user.last_logged_out) : 'N/A'}</td>
            <td>
                <span class="badge ${user.disabled ? 'bg-danger' : 'bg-success'}">${statusText}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

/**
 * Render VPN charts
 * @param {object} historyData - Historical VPN data
 * @param {number} hours - Time range in hours
 */
function renderVpnCharts(historyData, hours) {
    // Render connections chart
    if (historyData.connections) {
        renderConnectionsChart(historyData.connections, hours);
    }
    
    // Render traffic chart
    if (historyData.traffic) {
        renderTrafficChart(historyData.traffic, hours);
    }
}

/**
 * Render VPN connections chart
 * @param {array} connectionsData - Connections data
 * @param {number} hours - Time range in hours
 */
function renderConnectionsChart(connectionsData, hours) {
    // Filter data based on time range
    const timeFilter = new Date();
    timeFilter.setHours(timeFilter.getHours() - hours);
    
    const filteredData = connectionsData.filter(item => new Date(item.timestamp) >= timeFilter);
    
    // Prepare data
    const timestamps = filteredData.map(item => new Date(item.timestamp));
    const activeCounts = filteredData.map(item => item.active_count || 0);
    const byType = {};
    
    // Process connection types
    filteredData.forEach(item => {
        if (item.by_type) {
            Object.keys(item.by_type).forEach(type => {
                if (!byType[type]) {
                    byType[type] = new Array(filteredData.length).fill(0);
                }
                const index = timestamps.findIndex(t => t.getTime() === new Date(item.timestamp).getTime());
                if (index >= 0) {
                    byType[type][index] = item.by_type[type];
                }
            });
        }
    });
    
    // Create datasets
    const datasets = [
        {
            label: 'Total Connections',
            data: activeCounts,
            borderColor: '#0dcaf0',
            backgroundColor: 'rgba(13, 202, 240, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }
    ];
    
    // Add datasets for each connection type
    Object.keys(byType).forEach((type, index) => {
        const colors = ['#fd7e14', '#20c997', '#6f42c1', '#d63384', '#ffc107'];
        datasets.push({
            label: `${type.toUpperCase()} Connections`,
            data: byType[type],
            borderColor: colors[index % colors.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4
        });
    });
    
    // Create chart
    const ctx = document.getElementById('vpnConnectionsChart').getContext('2d');
    
    if (vpnConnectionsChart) {
        vpnConnectionsChart.destroy();
    }
    
    vpnConnectionsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: hours <= 6 ? 'minute' : 'hour',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm'
                        }
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
                        text: 'Số kết nối'
                    },
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return formatDateTime(context[0].parsed.x);
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Kết nối VPN theo thời gian'
                }
            }
        }
    });
}

/**
 * Render VPN traffic chart
 * @param {array} trafficData - Traffic data
 * @param {number} hours - Time range in hours
 */
function renderTrafficChart(trafficData, hours) {
    // Filter data based on time range
    const timeFilter = new Date();
    timeFilter.setHours(timeFilter.getHours() - hours);
    
    const filteredData = trafficData.filter(item => new Date(item.timestamp) >= timeFilter);
    
    // Prepare data
    const timestamps = filteredData.map(item => new Date(item.timestamp));
    const rxData = filteredData.map(item => item.rx_bits_per_second || 0);
    const txData = filteredData.map(item => item.tx_bits_per_second || 0);
    
    // Create chart
    const ctx = document.getElementById('vpnTrafficChart').getContext('2d');
    
    if (vpnTrafficChart) {
        vpnTrafficChart.destroy();
    }
    
    vpnTrafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: 'Download (RX)',
                    data: rxData,
                    borderColor: '#20c997',
                    backgroundColor: 'rgba(32, 201, 151, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Upload (TX)',
                    data: txData,
                    borderColor: '#fd7e14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: hours <= 6 ? 'minute' : 'hour',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm'
                        }
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
                        text: 'Lưu lượng (bps)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatTraffic(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return formatDateTime(context[0].parsed.x);
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatTraffic(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Lưu lượng VPN theo thời gian'
                }
            }
        }
    });
}

/**
 * Show error message
 */
function showError(message) {
    toast.showError(message);
}

/**
 * Show success message
 */
function showSuccess(message) {
    toast.showSuccess(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeVpnMonitoring();
});