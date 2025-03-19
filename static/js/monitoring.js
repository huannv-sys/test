/**
 * Monitoring functionality
 * Handles the monitoring view and metrics display
 */

// Chart instances
let cpuMetricChart = null;
let memoryMetricChart = null;
let trafficChart = null;

// Selected device and interface
let selectedDeviceId = null;
let selectedInterface = null;

// Default options
const defaultOptions = {
    cpuTimeRange: 24, // hours
    memoryTimeRange: 24, // hours
    trafficTimeRange: 24 // hours
};

/**
 * Initialize monitoring page
 */
async function initializeMonitoring() {
    console.log('Initializing monitoring...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load devices
    await loadDevices();
    
    // Load alert rules
    await loadAlertRules();
    
    // Load recent alerts if alert tab is active
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('alerts')) {
        await loadRecentAlerts();
    }
    
    // Check if device ID is in URL
    if (urlParams.has('device')) {
        const deviceId = parseInt(urlParams.get('device'));
        if (deviceId) {
            // Find device in list and select it
            const deviceElement = document.querySelector(`.device-item[data-device-id="${deviceId}"]`);
            if (deviceElement) {
                deviceElement.click();
            }
        }
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-monitoring').addEventListener('click', function() {
        if (selectedDeviceId) {
            loadMetrics(selectedDeviceId);
            loadInterfaces(selectedDeviceId);
        }
        loadAlertRules();
    });
    
    // Time range selectors for each chart
    document.querySelectorAll('.time-range').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const hours = parseInt(this.dataset.hours);
            const chartType = this.dataset.chart;
            
            if (chartType === 'cpu') {
                defaultOptions.cpuTimeRange = hours;
                if (selectedDeviceId) loadCpuMetrics(selectedDeviceId);
            } else if (chartType === 'memory') {
                defaultOptions.memoryTimeRange = hours;
                if (selectedDeviceId) loadMemoryMetrics(selectedDeviceId);
            } else if (chartType === 'traffic') {
                defaultOptions.trafficTimeRange = hours;
                if (selectedDeviceId) loadTrafficData(selectedDeviceId, selectedInterface);
            }
        });
    });
    
    // Save alert rule button
    document.getElementById('saveAlertRuleBtn').addEventListener('click', function() {
        saveAlertRule();
    });
    
    // Update alert rule button
    document.getElementById('updateAlertRuleBtn').addEventListener('click', function() {
        updateAlertRule();
    });
    
    // Delete alert rule confirmation
    document.getElementById('deleteAlertRuleBtn').addEventListener('click', function() {
        const ruleId = document.getElementById('edit_alert_id').value;
        const ruleName = document.getElementById('edit_alert_name').value;
        
        document.getElementById('delete-alert-rule-name').textContent = ruleName;
        
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteAlertRuleConfirmModal'));
        deleteModal.show();
    });
    
    // Confirm delete alert rule
    document.getElementById('confirmDeleteAlertRuleBtn').addEventListener('click', function() {
        deleteAlertRule();
    });
}

/**
 * Initialize charts
 */
function initCharts() {
    if (cpuMetricChart) {
        cpuMetricChart.destroy();
        cpuMetricChart = null;
    }
    
    if (memoryMetricChart) {
        memoryMetricChart.destroy();
        memoryMetricChart = null;
    }
    
    if (trafficChart) {
        trafficChart.destroy();
        trafficChart = null;
    }
}

/**
 * Load devices list
 */
async function loadDevices() {
    try {
        document.getElementById('devices-loading').style.display = 'block';
        document.getElementById('devices-list').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDevices();
        
        const devicesList = document.getElementById('devices-list');
        devicesList.innerHTML = '';
        
        if (response.devices && response.devices.length > 0) {
            response.devices.forEach(device => {
                const deviceElement = document.createElement('a');
                deviceElement.href = '#';
                deviceElement.className = `list-group-item list-group-item-action device-item ${device.status === 'online' ? '' : 'text-muted'}`;
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
                    document.querySelectorAll('.device-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Add active class to clicked device
                    this.classList.add('active');
                    
                    // Load device data
                    const deviceId = parseInt(this.dataset.deviceId);
                    selectedDeviceId = deviceId;
                    
                    loadDeviceOverview(deviceId);
                    loadMetrics(deviceId);
                    loadInterfaces(deviceId);
                });
                
                devicesList.appendChild(deviceElement);
            });
        } else {
            devicesList.innerHTML = '<div class="text-center p-3 text-muted">Không có thiết bị nào</div>';
        }
        
        document.getElementById('devices-loading').style.display = 'none';
        document.getElementById('devices-list').style.display = 'block';
    } catch (error) {
        console.error('Error loading devices:', error);
        showError('Không thể tải danh sách thiết bị');
        document.getElementById('devices-loading').style.display = 'none';
        document.getElementById('devices-list').style.display = 'block';
    }
}

/**
 * Load device overview
 * @param {number} deviceId - Device ID
 */
async function loadDeviceOverview(deviceId) {
    try {
        document.getElementById('overview-loading').style.display = 'block';
        document.getElementById('device-overview').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceMetrics(deviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải thông tin thiết bị');
        }
        
        // Set device name in header
        document.getElementById('device-name-header').textContent = `- ${response.device.name}`;
        
        // Update CPU info
        if (response.metrics && response.metrics.cpu) {
            const cpu = response.metrics.cpu;
            document.getElementById('cpu-usage').textContent = `${cpu.usage || 0}%`;
            document.getElementById('cpu-load').textContent = `Loads: ${cpu.load1 || '--'} / ${cpu.load5 || '--'} / ${cpu.load15 || '--'}`;
            document.getElementById('cpu-cores').textContent = `Cores: ${cpu.cores || '--'}`;
            document.getElementById('cpu-frequency').textContent = `Frequency: ${cpu.frequency || '--'} MHz`;
            document.getElementById('cpu-progress').style.width = `${cpu.usage || 0}%`;
            
            // Set color based on usage
            const cpuProgress = document.getElementById('cpu-progress');
            if (cpu.usage > 80) {
                cpuProgress.className = 'progress-bar bg-danger';
            } else if (cpu.usage > 60) {
                cpuProgress.className = 'progress-bar bg-warning';
            } else {
                cpuProgress.className = 'progress-bar bg-info';
            }
        }
        
        // Update Memory info
        if (response.metrics && response.metrics.memory) {
            const memory = response.metrics.memory;
            document.getElementById('memory-usage').textContent = `${memory.usage || 0}%`;
            document.getElementById('memory-used').textContent = `Used: ${formatBytes(memory.used || 0)}`;
            document.getElementById('memory-total').textContent = `Total: ${formatBytes(memory.total || 0)}`;
            document.getElementById('memory-free').textContent = `Free: ${formatBytes(memory.free || 0)}`;
            document.getElementById('memory-progress').style.width = `${memory.usage || 0}%`;
            
            // Set color based on usage
            const memoryProgress = document.getElementById('memory-progress');
            if (memory.usage > 80) {
                memoryProgress.className = 'progress-bar bg-danger';
            } else if (memory.usage > 60) {
                memoryProgress.className = 'progress-bar bg-warning';
            } else {
                memoryProgress.className = 'progress-bar bg-info';
            }
        }
        
        // Update Disk info
        if (response.metrics && response.metrics.disk) {
            const disk = response.metrics.disk;
            document.getElementById('disk-usage').textContent = `${disk.usage || 0}%`;
            document.getElementById('disk-used').textContent = `Used: ${formatBytes(disk.used || 0)}`;
            document.getElementById('disk-total').textContent = `Total: ${formatBytes(disk.total || 0)}`;
            document.getElementById('disk-free').textContent = `Free: ${formatBytes(disk.free || 0)}`;
            document.getElementById('disk-progress').style.width = `${disk.usage || 0}%`;
            
            // Set color based on usage
            const diskProgress = document.getElementById('disk-progress');
            if (disk.usage > 80) {
                diskProgress.className = 'progress-bar bg-danger';
            } else if (disk.usage > 60) {
                diskProgress.className = 'progress-bar bg-warning';
            } else {
                diskProgress.className = 'progress-bar bg-info';
            }
        }
        
        // Update System info
        if (response.metrics && response.metrics.system) {
            const system = response.metrics.system;
            document.getElementById('system-uptime').textContent = system.uptime || '--';
            document.getElementById('system-version').textContent = system.os_version || '--';
            document.getElementById('system-firmware').textContent = system.firmware || '--';
            document.getElementById('system-model').textContent = system.model || '--';
        }
        
        document.getElementById('device-overview').style.display = 'flex';
        document.getElementById('overview-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading device overview:', error);
        showError('Không thể tải thông tin thiết bị');
        clearDeviceOverview();
        document.getElementById('overview-loading').style.display = 'none';
    }
}

/**
 * Load interfaces for a device
 * @param {number} deviceId - Device ID
 */
async function loadInterfaces(deviceId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceInterfaces(deviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải danh sách interfaces');
        }
        
        const interfacesTable = document.getElementById('interfaces-table-body');
        interfacesTable.innerHTML = '';
        
        // Also update interface dropdown for traffic chart
        const interfaceList = document.getElementById('interface-list');
        interfaceList.innerHTML = `
            <a class="dropdown-item interface-select" href="#" data-interface="">Tất cả interfaces</a>
            <div class="dropdown-divider"></div>
        `;
        
        if (response.interfaces && response.interfaces.length > 0) {
            response.interfaces.forEach(iface => {
                // Add to table
                const row = document.createElement('tr');
                const statusClass = iface.running ? 'status-active' : 'status-inactive';
                row.innerHTML = `
                    <td>${iface.name}</td>
                    <td>${iface.type || '--'}</td>
                    <td>
                        <span class="status-circle ${statusClass}"></span>
                        ${iface.running ? 'Up' : 'Down'}
                    </td>
                    <td>${iface.mac_address || '--'}</td>
                    <td>${iface.rx_byte ? formatTraffic(iface.rx_byte * 8) : '--'}</td>
                    <td>${iface.tx_byte ? formatTraffic(iface.tx_byte * 8) : '--'}</td>
                `;
                interfacesTable.appendChild(row);
                
                // Add to dropdown
                const option = document.createElement('a');
                option.href = '#';
                option.className = 'dropdown-item interface-select';
                option.dataset.interface = iface.name;
                option.textContent = iface.name;
                option.addEventListener('click', function(e) {
                    e.preventDefault();
                    selectedInterface = iface.name;
                    loadTrafficData(deviceId, iface.name);
                });
                interfaceList.appendChild(option);
            });
        } else {
            interfacesTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">Không có interfaces</td>
                </tr>
            `;
        }
        
        // Add event listener to "All interfaces" option
        const allInterfacesOption = document.querySelector('.interface-select[data-interface=""]');
        if (allInterfacesOption) {
            allInterfacesOption.addEventListener('click', function(e) {
                e.preventDefault();
                selectedInterface = null;
                loadTrafficData(deviceId);
            });
        }
    } catch (error) {
        console.error('Error loading interfaces:', error);
        showError('Không thể tải danh sách interfaces');
    }
}

/**
 * Clear device overview
 */
function clearDeviceOverview() {
    document.getElementById('device-name-header').textContent = '';
    document.getElementById('cpu-usage').textContent = '--%';
    document.getElementById('cpu-load').textContent = 'Loads: --';
    document.getElementById('cpu-cores').textContent = 'Cores: --';
    document.getElementById('cpu-frequency').textContent = 'Frequency: --';
    document.getElementById('cpu-progress').style.width = '0%';
    document.getElementById('cpu-progress').className = 'progress-bar bg-info';
    
    document.getElementById('memory-usage').textContent = '--%';
    document.getElementById('memory-used').textContent = 'Used: --';
    document.getElementById('memory-total').textContent = 'Total: --';
    document.getElementById('memory-free').textContent = 'Free: --';
    document.getElementById('memory-progress').style.width = '0%';
    document.getElementById('memory-progress').className = 'progress-bar bg-info';
    
    document.getElementById('disk-usage').textContent = '--%';
    document.getElementById('disk-used').textContent = 'Used: --';
    document.getElementById('disk-total').textContent = 'Total: --';
    document.getElementById('disk-free').textContent = 'Free: --';
    document.getElementById('disk-progress').style.width = '0%';
    document.getElementById('disk-progress').className = 'progress-bar bg-info';
    
    document.getElementById('system-uptime').textContent = '--';
    document.getElementById('system-version').textContent = '--';
    document.getElementById('system-firmware').textContent = '--';
    document.getElementById('system-model').textContent = '--';
}

/**
 * Clear metrics charts
 */
function clearMetrics() {
    if (cpuMetricChart) {
        cpuMetricChart.destroy();
        cpuMetricChart = null;
    }
    
    if (memoryMetricChart) {
        memoryMetricChart.destroy();
        memoryMetricChart = null;
    }
    
    if (trafficChart) {
        trafficChart.destroy();
        trafficChart = null;
    }
}

/**
 * Load all metrics for a device
 * @param {number} deviceId - Device ID
 */
async function loadMetrics(deviceId) {
    clearMetrics();
    loadCpuMetrics(deviceId);
    loadMemoryMetrics(deviceId);
    loadTrafficData(deviceId, selectedInterface);
}

/**
 * Load CPU metrics for a device
 * @param {number} deviceId - Device ID
 */
async function loadCpuMetrics(deviceId) {
    try {
        document.getElementById('cpu-chart-loading').style.display = 'block';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceMetrics(deviceId);
        
        if (!response.success || !response.history || !response.history.cpu) {
            throw new Error(response.message || 'Không thể tải dữ liệu CPU');
        }
        
        const cpuData = response.history.cpu;
        const ctx = document.getElementById('cpuMetricChart').getContext('2d');
        
        // Prepare data
        const labels = [];
        const usageData = [];
        const load1Data = [];
        const load5Data = [];
        
        cpuData.forEach(point => {
            labels.push(new Date(point.timestamp));
            usageData.push(point.usage);
            load1Data.push(point.load1);
            load5Data.push(point.load5);
        });
        
        // Create chart
        cpuMetricChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CPU Usage (%)',
                        data: usageData,
                        borderColor: '#0dcaf0',
                        backgroundColor: 'rgba(13, 202, 240, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Load (1 min)',
                        data: load1Data,
                        borderColor: '#fd7e14',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Load (5 min)',
                        data: load5Data,
                        borderColor: '#6f42c1',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [3, 3],
                        fill: false,
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
                            unit: 'hour',
                            displayFormats: {
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
                            text: 'Sử dụng CPU (%)'
                        },
                        suggestedMax: 100
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return formatDateTime(context[0].parsed.x);
                            }
                        }
                    }
                }
            }
        });
        
        document.getElementById('cpu-chart-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading CPU metrics:', error);
        showError('Không thể tải dữ liệu CPU');
        document.getElementById('cpu-chart-loading').style.display = 'none';
    }
}

/**
 * Load memory metrics for a device
 * @param {number} deviceId - Device ID
 */
async function loadMemoryMetrics(deviceId) {
    try {
        document.getElementById('memory-chart-loading').style.display = 'block';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceMetrics(deviceId);
        
        if (!response.success || !response.history || !response.history.memory) {
            throw new Error(response.message || 'Không thể tải dữ liệu Memory');
        }
        
        const memoryData = response.history.memory;
        const ctx = document.getElementById('memoryMetricChart').getContext('2d');
        
        // Prepare data
        const labels = [];
        const usageData = [];
        const usedData = [];
        const freeData = [];
        
        memoryData.forEach(point => {
            labels.push(new Date(point.timestamp));
            usageData.push(point.usage);
            usedData.push(point.used / 1024 / 1024); // Convert to MB
            freeData.push(point.free / 1024 / 1024); // Convert to MB
        });
        
        // Create chart
        memoryMetricChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Memory Usage (%)',
                        data: usageData,
                        borderColor: '#0dcaf0',
                        backgroundColor: 'rgba(13, 202, 240, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Used Memory (MB)',
                        data: usedData,
                        borderColor: '#fd7e14',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Free Memory (MB)',
                        data: freeData,
                        borderColor: '#20c997',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
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
                            unit: 'hour',
                            displayFormats: {
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Sử dụng Memory (%)'
                        },
                        suggestedMax: 100
                    },
                    y1: {
                        beginAtZero: true,
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Memory (MB)'
                        },
                        grid: {
                            drawOnChartArea: false
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
                                    if (context.datasetIndex === 0) {
                                        label += context.parsed.y + '%';
                                    } else {
                                        label += context.parsed.y.toFixed(2) + ' MB';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
        document.getElementById('memory-chart-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading memory metrics:', error);
        showError('Không thể tải dữ liệu Memory');
        document.getElementById('memory-chart-loading').style.display = 'none';
    }
}

/**
 * Load disk metrics for a device
 * @param {number} deviceId - Device ID
 */
async function loadDiskMetrics(deviceId) {
    // Similar to loadMemoryMetrics but for disk data
    // This function is not currently used in the UI
}

/**
 * Load traffic data for a device
 * @param {number} deviceId - Device ID
 * @param {string} interfaceName - Interface name (optional)
 */
async function loadTrafficData(deviceId, interfaceName) {
    try {
        document.getElementById('traffic-chart-loading').style.display = 'block';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDeviceTraffic(deviceId, interfaceName, defaultOptions.trafficTimeRange);
        
        if (!response.success || !response.traffic) {
            throw new Error(response.message || 'Không thể tải dữ liệu lưu lượng');
        }
        
        const trafficData = response.traffic;
        const ctx = document.getElementById('trafficChart').getContext('2d');
        
        // Prepare data
        const labels = [];
        const rxData = [];
        const txData = [];
        
        trafficData.forEach(point => {
            labels.push(new Date(point.timestamp));
            rxData.push(point.rx_bits_per_second);
            txData.push(point.tx_bits_per_second);
        });
        
        // Create chart
        trafficChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
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
                            unit: 'hour',
                            displayFormats: {
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
                        text: interfaceName ? `Interface: ${interfaceName}` : 'All Interfaces'
                    }
                }
            }
        });
        
        document.getElementById('traffic-chart-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading traffic data:', error);
        showError('Không thể tải dữ liệu lưu lượng');
        document.getElementById('traffic-chart-loading').style.display = 'none';
    }
}

/**
 * Load alert rules
 */
async function loadAlertRules() {
    try {
        document.getElementById('alert-rules-loading').style.display = 'block';
        document.getElementById('alert-rules-list').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getAlertRules();
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải danh sách cảnh báo');
        }
        
        const rulesList = document.getElementById('alert-rules-list');
        rulesList.innerHTML = '';
        
        // Also update device selects in modals
        const deviceSelects = [
            document.getElementById('alert_device'),
            document.getElementById('edit_alert_device')
        ];
        
        deviceSelects.forEach(select => {
            // Clear options except the first one
            while (select.options.length > 1) {
                select.remove(1);
            }
        });
        
        // Load devices for selects
        const devicesResponse = await apiClient.getDevices();
        
        if (devicesResponse.devices && devicesResponse.devices.length > 0) {
            devicesResponse.devices.forEach(device => {
                deviceSelects.forEach(select => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = device.name;
                    select.appendChild(option);
                });
            });
        }
        
        if (response.rules && response.rules.length > 0) {
            response.rules.forEach(rule => {
                const ruleElement = document.createElement('div');
                ruleElement.className = 'card mb-2';
                
                const deviceName = rule.device_name || `Device #${rule.device_id}`;
                const metricName = rule.metric.replace('_', ' ');
                
                const statusBadge = rule.enabled ? 
                    '<span class="badge bg-success">Enabled</span>' : 
                    '<span class="badge bg-secondary">Disabled</span>';
                
                ruleElement.innerHTML = `
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${rule.name}</h6>
                            ${statusBadge}
                        </div>
                        <div class="text-muted small">
                            <div>${deviceName} | ${metricName} ${rule.condition} ${rule.threshold}</div>
                        </div>
                        <div class="d-flex justify-content-end mt-2">
                            <button class="btn btn-sm btn-outline-primary edit-rule" data-rule-id="${rule.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                // Add event listener
                ruleElement.querySelector('.edit-rule').addEventListener('click', function() {
                    showEditAlertRuleModal(rule.id);
                });
                
                rulesList.appendChild(ruleElement);
            });
        } else {
            rulesList.innerHTML = '<div class="text-center p-3 text-muted">Không có cảnh báo nào</div>';
        }
        
        document.getElementById('alert-rules-loading').style.display = 'none';
        document.getElementById('alert-rules-list').style.display = 'block';
    } catch (error) {
        console.error('Error loading alert rules:', error);
        showError('Không thể tải danh sách cảnh báo');
        document.getElementById('alert-rules-loading').style.display = 'none';
        document.getElementById('alert-rules-list').style.display = 'block';
    }
}

/**
 * Load recent alerts
 */
async function loadRecentAlerts() {
    // This function can be implemented based on API to show recent alerts in a tab
}

/**
 * Save alert rule
 */
async function saveAlertRule() {
    try {
        const formData = {
            name: document.getElementById('alert_name').value,
            device_id: parseInt(document.getElementById('alert_device').value),
            metric: document.getElementById('alert_metric').value,
            condition: document.getElementById('alert_condition').value,
            threshold: parseFloat(document.getElementById('alert_threshold').value),
            duration: parseInt(document.getElementById('alert_duration').value || 0),
            notify_email: document.getElementById('alert_email').checked,
            notify_telegram: document.getElementById('alert_telegram').checked,
            email_recipients: document.getElementById('alert_email_recipients').value,
            message_template: document.getElementById('alert_message').value
        };
        
        if (!formData.name || !formData.device_id || !formData.metric || !formData.condition || isNaN(formData.threshold)) {
            throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc');
        }
        
        const apiClient = new ApiClient();
        const response = await apiClient.createAlertRule(formData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tạo cảnh báo');
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAlertRuleModal'));
        modal.hide();
        
        // Show success message
        showSuccess('Đã tạo cảnh báo thành công');
        
        // Reset form
        document.getElementById('addAlertRuleForm').reset();
        
        // Reload alert rules
        await loadAlertRules();
    } catch (error) {
        console.error('Error saving alert rule:', error);
        showError(error.message || 'Không thể tạo cảnh báo');
    }
}

/**
 * Show edit alert rule modal
 * @param {number} ruleId - Alert rule ID
 */
async function showEditAlertRuleModal(ruleId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getAlertRules();
        
        if (!response.success || !response.rules) {
            throw new Error(response.message || 'Không thể tải thông tin cảnh báo');
        }
        
        const rule = response.rules.find(r => r.id === ruleId);
        
        if (!rule) {
            throw new Error('Không tìm thấy cảnh báo');
        }
        
        // Fill form
        document.getElementById('edit_alert_id').value = rule.id;
        document.getElementById('edit_alert_name').value = rule.name;
        document.getElementById('edit_alert_device').value = rule.device_id;
        document.getElementById('edit_alert_metric').value = rule.metric;
        document.getElementById('edit_alert_condition').value = rule.condition;
        document.getElementById('edit_alert_threshold').value = rule.threshold;
        document.getElementById('edit_alert_duration').value = rule.duration || 0;
        document.getElementById('edit_alert_email').checked = rule.notify_email;
        document.getElementById('edit_alert_telegram').checked = rule.notify_telegram;
        document.getElementById('edit_alert_email_recipients').value = rule.email_recipients || '';
        document.getElementById('edit_alert_message').value = rule.message_template || '';
        document.getElementById('edit_alert_enabled').checked = rule.enabled;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editAlertRuleModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading alert rule:', error);
        showError(error.message || 'Không thể tải thông tin cảnh báo');
    }
}

/**
 * Update alert rule
 */
async function updateAlertRule() {
    try {
        const ruleId = parseInt(document.getElementById('edit_alert_id').value);
        
        const formData = {
            name: document.getElementById('edit_alert_name').value,
            device_id: parseInt(document.getElementById('edit_alert_device').value),
            metric: document.getElementById('edit_alert_metric').value,
            condition: document.getElementById('edit_alert_condition').value,
            threshold: parseFloat(document.getElementById('edit_alert_threshold').value),
            duration: parseInt(document.getElementById('edit_alert_duration').value || 0),
            notify_email: document.getElementById('edit_alert_email').checked,
            notify_telegram: document.getElementById('edit_alert_telegram').checked,
            email_recipients: document.getElementById('edit_alert_email_recipients').value,
            message_template: document.getElementById('edit_alert_message').value,
            enabled: document.getElementById('edit_alert_enabled').checked
        };
        
        if (!formData.name || !formData.device_id || !formData.metric || !formData.condition || isNaN(formData.threshold)) {
            throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc');
        }
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateAlertRule(ruleId, formData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể cập nhật cảnh báo');
        }
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editAlertRuleModal'));
        modal.hide();
        
        // Show success message
        showSuccess('Đã cập nhật cảnh báo thành công');
        
        // Reload alert rules
        await loadAlertRules();
    } catch (error) {
        console.error('Error updating alert rule:', error);
        showError(error.message || 'Không thể cập nhật cảnh báo');
    }
}

/**
 * Delete alert rule
 */
async function deleteAlertRule() {
    try {
        const ruleId = parseInt(document.getElementById('edit_alert_id').value);
        
        const apiClient = new ApiClient();
        const response = await apiClient.deleteAlertRule(ruleId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể xóa cảnh báo');
        }
        
        // Close modals
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editAlertRuleModal'));
        const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteAlertRuleConfirmModal'));
        
        if (editModal) editModal.hide();
        if (deleteModal) deleteModal.hide();
        
        // Show success message
        showSuccess('Đã xóa cảnh báo thành công');
        
        // Reload alert rules
        await loadAlertRules();
    } catch (error) {
        console.error('Error deleting alert rule:', error);
        showError(error.message || 'Không thể xóa cảnh báo');
    }
}

// Show error message helper
function showError(message) {
    toast.showError(message);
}

// Show success message helper
function showSuccess(message) {
    toast.showSuccess(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMonitoring();
});