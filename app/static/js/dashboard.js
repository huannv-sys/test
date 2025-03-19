/**
 * MikroTik Monitor - Dashboard
 * Xử lý trang Dashboard và hiển thị thông tin tổng quan
 */

// Charts toàn cục
let cpuChart = null;
let clientChart = null;

/**
 * Khởi tạo Dashboard
 */
async function initializeDashboard() {
    try {
        // Hiển thị loading
        showLoading();
        
        // Tải dữ liệu dashboard
        const response = await fetch('/api/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải dữ liệu dashboard');
        }
        
        const data = await response.json();
        
        // Cập nhật dữ liệu thống kê
        updateDeviceStats(data.stats);
        
        // Cập nhật trạng thái thiết bị
        updateDeviceStatusTable(data.devices);
        
        // Tạo hoặc cập nhật các biểu đồ
        createCPUChart(data.cpu_data);
        createClientChart(data.client_data);
        
        // Cập nhật cảnh báo gần đây
        updateRecentAlerts(data.alerts);
        
        // Ẩn loading
        hideLoading();
        
        // Bắt sự kiện click vào hàng trong bảng trạng thái thiết bị
        setupDeviceTableEvents();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        hideLoading();
        showError('Đã xảy ra lỗi khi tải dữ liệu dashboard');
    }
}

/**
 * Làm mới dữ liệu Dashboard
 */
async function refreshDashboard() {
    try {
        // Hiển thị loading
        showLoading();
        
        // Tải dữ liệu dashboard
        const response = await fetch('/api/dashboard', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải dữ liệu dashboard');
        }
        
        const data = await response.json();
        
        // Cập nhật dữ liệu thống kê
        updateDeviceStats(data.stats);
        
        // Cập nhật trạng thái thiết bị
        updateDeviceStatusTable(data.devices);
        
        // Cập nhật các biểu đồ
        updateCPUChart(data.cpu_data);
        updateClientChart(data.client_data);
        
        // Cập nhật cảnh báo gần đây
        updateRecentAlerts(data.alerts);
        
        // Ẩn loading
        hideLoading();
        
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
        hideLoading();
        showError('Đã xảy ra lỗi khi làm mới dữ liệu dashboard');
    }
}

/**
 * Cập nhật thống kê thiết bị
 * @param {object} deviceStats - Thống kê thiết bị
 */
function updateDeviceStats(deviceStats) {
    document.getElementById('totalDevices').textContent = deviceStats.total || 0;
    document.getElementById('onlineDevices').textContent = deviceStats.online || 0;
    document.getElementById('totalClients').textContent = deviceStats.clients || 0;
    document.getElementById('activeAlerts').textContent = deviceStats.alerts || 0;
}

/**
 * Cập nhật bảng trạng thái thiết bị
 * @param {array} devices - Danh sách thiết bị
 */
function updateDeviceStatusTable(devices) {
    const tableBody = document.querySelector('#deviceStatusTable tbody');
    
    if (!devices || devices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">Không có thiết bị nào</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    devices.forEach(device => {
        const statusClass = device.status === 'online' ? 'device-status-online' : 
                           (device.status === 'warning' ? 'device-status-warning' : 'device-status-offline');
        
        tableContent += `
            <tr data-device-id="${device.id}" class="device-row">
                <td>
                    <strong>${device.name}</strong>
                </td>
                <td>${device.ip_address}</td>
                <td>${device.model || 'N/A'}</td>
                <td>${formatUptime(device.uptime)}</td>
                <td>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar" role="progressbar" style="width: ${device.cpu_load || 0}%" 
                            aria-valuenow="${device.cpu_load || 0}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <span class="small">${device.cpu_load || 0}%</span>
                </td>
                <td>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${device.memory_usage || 0}%" 
                            aria-valuenow="${device.memory_usage || 0}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <span class="small">${device.memory_usage || 0}%</span>
                </td>
                <td>
                    <div class="traffic-sparkline">
                        <small>${formatTraffic(device.traffic_in || 0)} ↓</small><br>
                        <small>${formatTraffic(device.traffic_out || 0)} ↑</small>
                    </div>
                </td>
                <td>
                    <span class="device-status-dot ${statusClass}"></span>
                    ${device.status === 'online' ? 'Online' : 
                     (device.status === 'warning' ? 'Warning' : 'Offline')}
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
}

/**
 * Tạo biểu đồ CPU
 * @param {array} cpuData - Dữ liệu CPU
 */
function createCPUChart(cpuData) {
    const ctx = document.getElementById('cpuChart').getContext('2d');
    
    // Nếu đã có biểu đồ, hủy để tạo lại
    if (cpuChart) {
        cpuChart.destroy();
    }
    
    // Chuẩn bị dữ liệu
    const labels = cpuData.map(item => item.time);
    const datasets = [];
    
    // Tạo dataset cho mỗi thiết bị
    const devices = {};
    
    cpuData.forEach(item => {
        if (!devices[item.device_id]) {
            devices[item.device_id] = {
                label: item.device_name,
                data: [],
                borderColor: getRandomColor(),
                tension: 0.3,
                fill: false
            };
        }
        
        devices[item.device_id].data.push(item.value);
    });
    
    // Chuyển đổi đối tượng thành mảng
    for (const deviceId in devices) {
        datasets.push(devices[deviceId]);
    }
    
    // Tạo biểu đồ
    cpuChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'CPU (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Thời gian'
                    }
                }
            }
        }
    });
}

/**
 * Cập nhật biểu đồ CPU
 * @param {array} cpuData - Dữ liệu CPU
 */
function updateCPUChart(cpuData) {
    if (!cpuChart) {
        createCPUChart(cpuData);
        return;
    }
    
    // Cập nhật dữ liệu
    const labels = cpuData.map(item => item.time);
    cpuChart.data.labels = labels;
    
    // Cập nhật dataset cho mỗi thiết bị
    const devices = {};
    
    cpuData.forEach(item => {
        if (!devices[item.device_id]) {
            devices[item.device_id] = {
                label: item.device_name,
                data: [],
                borderColor: getRandomColor(),
                tension: 0.3,
                fill: false
            };
        }
        
        devices[item.device_id].data.push(item.value);
    });
    
    // Xóa datasets cũ
    cpuChart.data.datasets = [];
    
    // Thêm datasets mới
    for (const deviceId in devices) {
        cpuChart.data.datasets.push(devices[deviceId]);
    }
    
    // Cập nhật biểu đồ
    cpuChart.update();
}

/**
 * Tạo biểu đồ Client
 * @param {array} clientData - Dữ liệu Client
 */
function createClientChart(clientData) {
    const ctx = document.getElementById('clientChart').getContext('2d');
    
    // Nếu đã có biểu đồ, hủy để tạo lại
    if (clientChart) {
        clientChart.destroy();
    }
    
    // Chuẩn bị dữ liệu
    const labels = clientData.map(item => item.time);
    const datasets = [];
    
    // Tạo dataset cho mỗi thiết bị
    const devices = {};
    
    clientData.forEach(item => {
        if (!devices[item.device_id]) {
            devices[item.device_id] = {
                label: item.device_name,
                data: [],
                borderColor: getRandomColor(),
                tension: 0.3,
                fill: false
            };
        }
        
        devices[item.device_id].data.push(item.value);
    });
    
    // Chuyển đổi đối tượng thành mảng
    for (const deviceId in devices) {
        datasets.push(devices[deviceId]);
    }
    
    // Tạo biểu đồ
    clientChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Số clients'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Thời gian'
                    }
                }
            }
        }
    });
}

/**
 * Cập nhật biểu đồ Client
 * @param {array} clientData - Dữ liệu Client
 */
function updateClientChart(clientData) {
    if (!clientChart) {
        createClientChart(clientData);
        return;
    }
    
    // Cập nhật dữ liệu
    const labels = clientData.map(item => item.time);
    clientChart.data.labels = labels;
    
    // Cập nhật dataset cho mỗi thiết bị
    const devices = {};
    
    clientData.forEach(item => {
        if (!devices[item.device_id]) {
            devices[item.device_id] = {
                label: item.device_name,
                data: [],
                borderColor: getRandomColor(),
                tension: 0.3,
                fill: false
            };
        }
        
        devices[item.device_id].data.push(item.value);
    });
    
    // Xóa datasets cũ
    clientChart.data.datasets = [];
    
    // Thêm datasets mới
    for (const deviceId in devices) {
        clientChart.data.datasets.push(devices[deviceId]);
    }
    
    // Cập nhật biểu đồ
    clientChart.update();
}

/**
 * Cập nhật phần cảnh báo gần đây
 * @param {array} alerts - Cảnh báo gần đây
 */
function updateRecentAlerts(alerts) {
    const alertsContainer = document.getElementById('recentAlerts');
    
    if (!alerts || alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <p>Không có cảnh báo nào</p>
            </div>
        `;
        return;
    }
    
    let alertsContent = '';
    
    alerts.forEach(alert => {
        const alertClass = getAlertClass(alert.level);
        const statusBadgeClass = getStatusBadgeClass(alert.status);
        
        alertsContent += `
            <div class="alert-item ${alertClass}">
                <div class="d-flex justify-content-between">
                    <h6 class="mb-1">${alert.title}</h6>
                    <span class="badge ${statusBadgeClass}">${formatAlertStatus(alert.status)}</span>
                </div>
                <p class="mb-1">${alert.message}</p>
                <div class="d-flex justify-content-between">
                    <small>${alert.device_name}</small>
                    <small>${formatTimeAgo(new Date(alert.created_at))}</small>
                </div>
            </div>
        `;
    });
    
    alertsContainer.innerHTML = alertsContent;
}

/**
 * Thiết lập sự kiện cho bảng trạng thái thiết bị
 */
function setupDeviceTableEvents() {
    // Bắt sự kiện click vào hàng trong bảng
    const deviceRows = document.querySelectorAll('.device-row');
    
    deviceRows.forEach(row => {
        row.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            showDeviceQuickView(deviceId);
        });
    });
}

/**
 * Hiển thị thông tin nhanh của thiết bị
 * @param {number} deviceId - ID của thiết bị
 */
async function showDeviceQuickView(deviceId) {
    try {
        // Hiển thị loading
        showLoading();
        
        // Lấy thông tin thiết bị
        const response = await fetch(`/api/devices/${deviceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải thông tin thiết bị');
        }
        
        const device = await response.json();
        
        // Lấy metrics của thiết bị
        const metricsResponse = await fetch(`/api/devices/${deviceId}/metrics`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        let metrics = {};
        if (metricsResponse.ok) {
            metrics = await metricsResponse.json();
        }
        
        // Lấy interfaces của thiết bị
        const interfacesResponse = await fetch(`/api/devices/${deviceId}/interfaces`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        let interfaces = [];
        if (interfacesResponse.ok) {
            interfaces = await interfacesResponse.json();
        }
        
        // Cập nhật modal với thông tin thiết bị
        document.getElementById('quickViewName').textContent = device.name;
        document.getElementById('quickViewModel').textContent = device.model || 'N/A';
        document.getElementById('quickViewVersion').textContent = device.version || 'N/A';
        document.getElementById('quickViewUptime').textContent = formatUptime(device.uptime);
        
        // Cập nhật thông tin tài nguyên
        const cpuUsage = metrics.cpu_load || 0;
        const memoryUsage = metrics.memory_usage || 0;
        const diskUsage = metrics.disk_usage || 0;
        
        document.getElementById('quickViewCpu').textContent = `${cpuUsage}%`;
        document.getElementById('quickViewCpuBar').style.width = `${cpuUsage}%`;
        
        document.getElementById('quickViewMemory').textContent = `${memoryUsage}%`;
        document.getElementById('quickViewMemoryBar').style.width = `${memoryUsage}%`;
        
        document.getElementById('quickViewDisk').textContent = `${diskUsage}%`;
        document.getElementById('quickViewDiskBar').style.width = `${diskUsage}%`;
        
        // Cập nhật bảng interfaces
        updateQuickViewInterfaces(interfaces);
        
        // Cập nhật links
        document.getElementById('quickViewMonitoringLink').href = `/monitoring?device=${deviceId}`;
        document.getElementById('quickViewDetailsLink').href = `/devices?device=${deviceId}`;
        
        // Ẩn loading
        hideLoading();
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('deviceQuickViewModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error showing device quick view:', error);
        hideLoading();
        showError('Đã xảy ra lỗi khi tải thông tin thiết bị');
    }
}

/**
 * Cập nhật bảng interfaces trong quick view
 * @param {array} interfaces - Danh sách interfaces
 */
function updateQuickViewInterfaces(interfaces) {
    const tableBody = document.querySelector('#quickViewInterfacesTable tbody');
    
    if (!interfaces || interfaces.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có interface nào</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    interfaces.forEach(iface => {
        const statusClass = iface.status === 'up' ? 'text-success' : 'text-danger';
        const status = iface.status === 'up' ? 'Up' : 'Down';
        
        tableContent += `
            <tr>
                <td>${iface.name}</td>
                <td>${iface.type || 'N/A'}</td>
                <td class="${statusClass}">${status}</td>
                <td>${iface.speed || 'N/A'}</td>
                <td>
                    <small>${formatTraffic(iface.rx_byte_rate || 0)} ↓</small><br>
                    <small>${formatTraffic(iface.tx_byte_rate || 0)} ↑</small>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
}

/**
 * Helper function để lấy class dựa trên mức độ cảnh báo
 * @param {string} level - Mức độ cảnh báo
 * @returns {string} - CSS class
 */
function getAlertClass(level) {
    switch (level) {
        case 'critical':
            return 'bg-danger bg-opacity-10 border-start border-danger border-4';
        case 'high':
            return 'bg-warning bg-opacity-10 border-start border-warning border-4';
        case 'medium':
            return 'bg-info bg-opacity-10 border-start border-info border-4';
        case 'low':
            return 'bg-success bg-opacity-10 border-start border-success border-4';
        default:
            return 'bg-light border-start border-secondary border-4';
    }
}

/**
 * Helper function để lấy class badge dựa trên trạng thái cảnh báo
 * @param {string} status - Trạng thái cảnh báo
 * @returns {string} - CSS class
 */
function getStatusBadgeClass(status) {
    switch (status) {
        case 'active':
            return 'bg-danger';
        case 'acknowledged':
            return 'bg-warning';
        case 'resolved':
            return 'bg-success';
        default:
            return 'bg-secondary';
    }
}

/**
 * Định dạng trạng thái cảnh báo để hiển thị
 * @param {string} status - Trạng thái cảnh báo
 * @returns {string} - Trạng thái đã định dạng
 */
function formatAlertStatus(status) {
    switch (status) {
        case 'active':
            return 'Đang hoạt động';
        case 'acknowledged':
            return 'Đã xác nhận';
        case 'resolved':
            return 'Đã giải quyết';
        default:
            return 'Không xác định';
    }
}

/**
 * Tạo màu ngẫu nhiên cho biểu đồ
 * @returns {string} - Màu ngẫu nhiên
 */
function getRandomColor() {
    const colors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
        '#5a5c69', '#6f42c1', '#fd7e14', '#20c997', '#6c757d'
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Định dạng thời gian tương đối (time ago)
 * @param {Date} date - Ngày cần định dạng
 * @returns {string} - Thời gian đã định dạng
 */
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) {
        return interval + ' năm trước';
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + ' tháng trước';
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + ' ngày trước';
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + ' giờ trước';
    }
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + ' phút trước';
    }
    
    if (seconds < 10) {
        return 'vừa xong';
    }
    
    return Math.floor(seconds) + ' giây trước';
}

/**
 * Định dạng uptime
 * @param {number} seconds - Số giây uptime
 * @returns {string} - Uptime đã định dạng
 */
function formatUptime(seconds) {
    if (!seconds) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Hiển thị loading indicators
 */
function showLoading() {
    // Nếu có một loading overlay, hiển thị nó
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * Ẩn loading indicators
 */
function hideLoading() {
    // Nếu có một loading overlay, ẩn nó
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Hiển thị thông báo lỗi
 * @param {string} message - Thông báo lỗi
 */
function showError(message) {
    if (typeof ToastManager !== 'undefined' && ToastManager.showError) {
        ToastManager.showError(message);
    } else {
        alert('Lỗi: ' + message);
    }
}

/**
 * Định dạng traffic
 */
function formatTraffic(bitsPerSecond) {
    if (bitsPerSecond === 0) return '0 bps';
    
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(1000));
    
    return (bitsPerSecond / Math.pow(1000, i)).toFixed(2) + ' ' + units[i];
}