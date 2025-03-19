/**
 * Devices functionality
 * Handles the device management view
 */

// Selected device ID for current operations
let selectedDeviceId = null;

// View mode (list or grid)
let viewMode = 'grid';

// Keep track of the last device scan results
let lastScanResults = [];

/**
 * Initialize devices page
 */
function initializeDevices() {
    console.log('Initializing devices...');
    
    // Set up all event listeners
    setupEventListeners();
    
    // Load devices
    loadDevices();
    
    // Set initial view mode
    viewMode = localStorage.getItem('deviceViewMode') || 'grid';
    updateViewModeButtons();
    document.getElementById('devices-container').className = `devices-container ${viewMode}-view`;
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // View mode toggle
    document.getElementById('list-view-btn').addEventListener('click', function() {
        viewMode = 'list';
        localStorage.setItem('deviceViewMode', viewMode);
        updateViewModeButtons();
        document.getElementById('devices-container').className = 'devices-container list-view';
    });
    
    document.getElementById('grid-view-btn').addEventListener('click', function() {
        viewMode = 'grid';
        localStorage.setItem('deviceViewMode', viewMode);
        updateViewModeButtons();
        document.getElementById('devices-container').className = 'devices-container grid-view';
    });
    
    // Refresh devices
    document.getElementById('refresh-devices').addEventListener('click', function() {
        loadDevices();
    });
    
    // Add device
    document.getElementById('add-device-btn').addEventListener('click', function() {
        document.getElementById('device-form').reset();
        document.getElementById('device-form-title').textContent = 'Thêm thiết bị mới';
        document.getElementById('saveDeviceBtn').style.display = 'block';
        document.getElementById('updateDeviceBtn').style.display = 'none';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('deviceModal'));
        modal.show();
    });
    
    // Save device
    document.getElementById('saveDeviceBtn').addEventListener('click', function() {
        saveDevice();
    });
    
    // Update device
    document.getElementById('updateDeviceBtn').addEventListener('click', function() {
        updateDevice();
    });
    
    // Delete device confirmation
    document.getElementById('deleteDeviceBtn').addEventListener('click', function() {
        const deviceName = document.getElementById('device_name').value;
        
        document.getElementById('delete-device-name').textContent = deviceName;
        
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteDeviceConfirmModal'));
        deleteModal.show();
    });
    
    // Confirm delete
    document.getElementById('confirmDeleteDeviceBtn').addEventListener('click', function() {
        deleteDevice();
    });
    
    // Device details tab handling
    const detailsTabs = document.querySelectorAll('#deviceDetailsModal .nav-link');
    detailsTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all tabs
            detailsTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Show corresponding tab content
            const tabContent = document.querySelectorAll('#deviceDetailsModal .tab-content .tab-pane');
            tabContent.forEach(content => content.classList.remove('show', 'active'));
            
            const target = this.getAttribute('data-bs-target');
            document.querySelector(target).classList.add('show', 'active');
        });
    });
    
    // Network scan
    document.getElementById('scan-network-btn').addEventListener('click', function() {
        document.getElementById('scan-subnet').value = '';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('scanNetworkModal'));
        modal.show();
    });
    
    // Start scan
    document.getElementById('startScanBtn').addEventListener('click', function() {
        startNetworkScan();
    });
    
    // Add discovered device
    document.getElementById('scan-results-table').addEventListener('click', function(e) {
        if (e.target.classList.contains('add-scanned-device')) {
            const row = e.target.closest('tr');
            const ipAddress = row.querySelector('.device-ip').textContent;
            const hostname = row.querySelector('.device-name').textContent;
            
            addScannedDevice(ipAddress, hostname);
        }
    });
    
    // Send command
    document.getElementById('sendCommandBtn').addEventListener('click', function() {
        runCommand();
    });
    
    // Backup config
    document.getElementById('backupConfigBtn').addEventListener('click', function() {
        backupConfig();
    });
    
    // Restore config
    document.getElementById('restoreConfigBtn').addEventListener('click', function() {
        restoreConfig();
    });
}

/**
 * Update view mode buttons
 */
function updateViewModeButtons() {
    if (viewMode === 'list') {
        document.getElementById('list-view-btn').classList.add('active');
        document.getElementById('grid-view-btn').classList.remove('active');
    } else {
        document.getElementById('list-view-btn').classList.remove('active');
        document.getElementById('grid-view-btn').classList.add('active');
    }
}

/**
 * Load devices from API
 */
async function loadDevices() {
    try {
        document.getElementById('devices-loading').style.display = 'block';
        document.getElementById('devices-container').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getDevices();
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải danh sách thiết bị');
        }
        
        if (viewMode === 'list') {
            updateDeviceList(response.devices || []);
        } else {
            updateDeviceGrid(response.devices || []);
        }
        
        document.getElementById('devices-loading').style.display = 'none';
        document.getElementById('devices-container').style.display = 'block';
    } catch (error) {
        console.error('Error loading devices:', error);
        showError('Không thể tải danh sách thiết bị');
        document.getElementById('devices-loading').style.display = 'none';
        document.getElementById('devices-container').style.display = 'block';
    }
}

/**
 * Update device list view with data
 */
function updateDeviceList(devices) {
    const tableBody = document.querySelector('#devices-table tbody');
    tableBody.innerHTML = '';
    
    if (devices.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">Không có thiết bị nào</td>
            </tr>
        `;
        return;
    }
    
    devices.forEach(device => {
        const row = document.createElement('tr');
        row.setAttribute('data-device-id', device.id);
        
        const statusClass = device.status === 'online' ? 'status-active' : 'status-inactive';
        const statusBadge = device.status === 'online' ? 
            '<span class="badge bg-success">Online</span>' : 
            '<span class="badge bg-danger">Offline</span>';
        
        row.innerHTML = `
            <td>
                <span class="status-circle ${statusClass}"></span>
                ${device.name}
            </td>
            <td>${device.ip_address}</td>
            <td>${device.model || '-'}</td>
            <td>${device.location || '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-info view-device" title="Xem chi tiết">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-primary edit-device" title="Chỉnh sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-device" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Add event listeners
        row.querySelector('.view-device').addEventListener('click', function() {
            showDeviceDetails(device.id);
        });
        
        row.querySelector('.edit-device').addEventListener('click', function() {
            showEditDeviceModal(device.id);
        });
        
        row.querySelector('.delete-device').addEventListener('click', function() {
            selectedDeviceId = device.id;
            
            document.getElementById('delete-device-name').textContent = device.name;
            
            const deleteModal = new bootstrap.Modal(document.getElementById('deleteDeviceConfirmModal'));
            deleteModal.show();
        });
        
        tableBody.appendChild(row);
        
        // Check device status
        checkDeviceStatus(device.id);
    });
}

/**
 * Update device grid view with data
 */
function updateDeviceGrid(devices) {
    const grid = document.getElementById('devices-grid');
    grid.innerHTML = '';
    
    if (devices.length === 0) {
        grid.innerHTML = '<div class="text-center p-4">Không có thiết bị nào</div>';
        return;
    }
    
    devices.forEach(device => {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.setAttribute('data-device-id', device.id);
        
        const statusClass = device.status === 'online' ? 'status-active' : 'status-inactive';
        
        card.innerHTML = `
            <div class="device-card-header">
                <span class="status-circle ${statusClass}"></span>
                <h6 class="device-name">${device.name}</h6>
            </div>
            <div class="device-card-body">
                <div class="device-ip">${device.ip_address}</div>
                <div class="device-model">${device.model || 'Unknown'}</div>
                <div class="device-location">${device.location || '-'}</div>
            </div>
            <div class="device-card-footer">
                <button type="button" class="btn btn-sm btn-outline-info view-device" title="Xem chi tiết">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-primary edit-device" title="Chỉnh sửa">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-device" title="Xóa">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        card.querySelector('.view-device').addEventListener('click', function() {
            showDeviceDetails(device.id);
        });
        
        card.querySelector('.edit-device').addEventListener('click', function() {
            showEditDeviceModal(device.id);
        });
        
        card.querySelector('.delete-device').addEventListener('click', function() {
            selectedDeviceId = device.id;
            
            document.getElementById('delete-device-name').textContent = device.name;
            
            const deleteModal = new bootstrap.Modal(document.getElementById('deleteDeviceConfirmModal'));
            deleteModal.show();
        });
        
        grid.appendChild(card);
        
        // Check device status
        checkDeviceGridStatus(device.id);
    });
}

/**
 * Check device status for list view
 */
async function checkDeviceStatus(deviceId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getDevice(deviceId);
        
        if (!response.success) {
            return;
        }
        
        const row = document.querySelector(`#devices-table tbody tr[data-device-id="${deviceId}"]`);
        if (!row) return;
        
        const statusCircle = row.querySelector('.status-circle');
        const statusBadge = row.querySelector('.badge');
        
        if (response.device.status === 'online') {
            statusCircle.className = 'status-circle status-active';
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'Online';
        } else {
            statusCircle.className = 'status-circle status-inactive';
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'Offline';
        }
    } catch (error) {
        console.error('Error checking device status:', error);
    }
}

/**
 * Check device status for grid view
 */
async function checkDeviceGridStatus(deviceId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getDevice(deviceId);
        
        if (!response.success) {
            return;
        }
        
        const card = document.querySelector(`.device-card[data-device-id="${deviceId}"]`);
        if (!card) return;
        
        const statusCircle = card.querySelector('.status-circle');
        
        if (response.device.status === 'online') {
            statusCircle.className = 'status-circle status-active';
        } else {
            statusCircle.className = 'status-circle status-inactive';
        }
    } catch (error) {
        console.error('Error checking device status:', error);
    }
}

/**
 * Save new device
 */
async function saveDevice() {
    try {
        const form = document.getElementById('device-form');
        
        // Basic validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const deviceData = {
            name: document.getElementById('device_name').value,
            ip_address: document.getElementById('device_ip').value,
            username: document.getElementById('device_username').value,
            password: document.getElementById('device_password').value,
            api_port: parseInt(document.getElementById('device_port').value),
            use_ssl: document.getElementById('device_ssl').checked,
            model: document.getElementById('device_model').value,
            location: document.getElementById('device_location').value,
            notes: document.getElementById('device_notes').value
        };
        
        document.getElementById('saveDeviceBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.createDevice(deviceData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể thêm thiết bị');
        }
        
        // Show success message
        showSuccess('Đã thêm thiết bị thành công');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deviceModal'));
        modal.hide();
        
        // Reload devices
        loadDevices();
    } catch (error) {
        console.error('Error saving device:', error);
        showError(error.message || 'Không thể thêm thiết bị');
    } finally {
        document.getElementById('saveDeviceBtn').disabled = false;
    }
}

/**
 * Show edit device modal
 */
async function showEditDeviceModal(deviceId) {
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getDevice(deviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải thông tin thiết bị');
        }
        
        const device = response.device;
        selectedDeviceId = device.id;
        
        // Set form values
        document.getElementById('device_name').value = device.name;
        document.getElementById('device_ip').value = device.ip_address;
        document.getElementById('device_username').value = device.username;
        document.getElementById('device_password').value = ''; // Don't show password
        document.getElementById('device_port').value = device.api_port;
        document.getElementById('device_ssl').checked = device.use_ssl;
        document.getElementById('device_model').value = device.model || '';
        document.getElementById('device_location').value = device.location || '';
        document.getElementById('device_notes').value = device.notes || '';
        
        // Update form title and buttons
        document.getElementById('device-form-title').textContent = 'Chỉnh sửa thiết bị';
        document.getElementById('saveDeviceBtn').style.display = 'none';
        document.getElementById('updateDeviceBtn').style.display = 'block';
        document.getElementById('deleteDeviceBtn').style.display = 'block';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('deviceModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading device:', error);
        showError(error.message || 'Không thể tải thông tin thiết bị');
    }
}

/**
 * Update device
 */
async function updateDevice() {
    try {
        const form = document.getElementById('device-form');
        
        // Basic validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const deviceData = {
            name: document.getElementById('device_name').value,
            ip_address: document.getElementById('device_ip').value,
            username: document.getElementById('device_username').value,
            api_port: parseInt(document.getElementById('device_port').value),
            use_ssl: document.getElementById('device_ssl').checked,
            model: document.getElementById('device_model').value,
            location: document.getElementById('device_location').value,
            notes: document.getElementById('device_notes').value
        };
        
        // Only include password if it was changed
        const password = document.getElementById('device_password').value;
        if (password) {
            deviceData.password = password;
        }
        
        document.getElementById('updateDeviceBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateDevice(selectedDeviceId, deviceData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể cập nhật thiết bị');
        }
        
        // Show success message
        showSuccess('Đã cập nhật thiết bị thành công');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deviceModal'));
        modal.hide();
        
        // Reload devices
        loadDevices();
    } catch (error) {
        console.error('Error updating device:', error);
        showError(error.message || 'Không thể cập nhật thiết bị');
    } finally {
        document.getElementById('updateDeviceBtn').disabled = false;
    }
}

/**
 * Delete device
 */
async function deleteDevice() {
    try {
        document.getElementById('confirmDeleteDeviceBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.deleteDevice(selectedDeviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể xóa thiết bị');
        }
        
        // Show success message
        showSuccess('Đã xóa thiết bị thành công');
        
        // Close modals
        const deviceModal = bootstrap.Modal.getInstance(document.getElementById('deviceModal'));
        const deleteModal = bootstrap.Modal.getInstance(document.getElementById('deleteDeviceConfirmModal'));
        
        if (deviceModal) deviceModal.hide();
        if (deleteModal) deleteModal.hide();
        
        // Reload devices
        loadDevices();
    } catch (error) {
        console.error('Error deleting device:', error);
        showError(error.message || 'Không thể xóa thiết bị');
    } finally {
        document.getElementById('confirmDeleteDeviceBtn').disabled = false;
    }
}

/**
 * Start network scan
 */
async function startNetworkScan() {
    try {
        const subnet = document.getElementById('scan-subnet').value;
        if (!subnet) {
            throw new Error('Vui lòng nhập subnet để quét');
        }
        
        // Validate subnet (basic validation)
        const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!subnetRegex.test(subnet)) {
            throw new Error('Định dạng subnet không hợp lệ (ví dụ: 192.168.1.0/24)');
        }
        
        document.getElementById('startScanBtn').disabled = true;
        document.getElementById('scan-loading').style.display = 'block';
        document.getElementById('scan-results-container').style.display = 'none';
        
        const apiClient = new ApiClient();
        const response = await apiClient.discoverDevices(subnet);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể quét mạng');
        }
        
        // Update results table
        const resultsTable = document.getElementById('scan-results-table');
        const tableBody = resultsTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        if (response.devices && response.devices.length > 0) {
            lastScanResults = response.devices;
            
            response.devices.forEach(device => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td class="device-ip">${device.ip_address}</td>
                    <td class="device-name">${device.hostname || '-'}</td>
                    <td>${device.mac_address || '-'}</td>
                    <td>${device.ports?.join(', ') || '-'}</td>
                    <td>${device.is_mikrotik ? 'Yes' : 'No'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary add-scanned-device">
                            <i class="fas fa-plus"></i> Thêm
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">Không tìm thấy thiết bị nào</td>
                </tr>
            `;
        }
        
        document.getElementById('scan-loading').style.display = 'none';
        document.getElementById('scan-results-container').style.display = 'block';
    } catch (error) {
        console.error('Error scanning network:', error);
        showError(error.message || 'Không thể quét mạng');
        document.getElementById('scan-loading').style.display = 'none';
    } finally {
        document.getElementById('startScanBtn').disabled = false;
    }
}

/**
 * Add discovered device
 */
function addScannedDevice(ipAddress, hostname) {
    // Find device in scan results
    const device = lastScanResults.find(d => d.ip_address === ipAddress);
    if (!device) return;
    
    // Populate form
    document.getElementById('device_name').value = hostname || `MikroTik ${ipAddress}`;
    document.getElementById('device_ip').value = ipAddress;
    document.getElementById('device_username').value = 'admin';
    document.getElementById('device_password').value = '';
    document.getElementById('device_port').value = device.ports?.includes(8729) ? 8729 : 8728;
    document.getElementById('device_ssl').checked = device.ports?.includes(8729);
    
    // Close scan modal and open device modal
    const scanModal = bootstrap.Modal.getInstance(document.getElementById('scanNetworkModal'));
    scanModal.hide();
    
    // Update form title and buttons
    document.getElementById('device-form-title').textContent = 'Thêm thiết bị mới';
    document.getElementById('saveDeviceBtn').style.display = 'block';
    document.getElementById('updateDeviceBtn').style.display = 'none';
    document.getElementById('deleteDeviceBtn').style.display = 'none';
    
    // Show device modal
    const deviceModal = new bootstrap.Modal(document.getElementById('deviceModal'));
    deviceModal.show();
}

/**
 * Show device details
 */
async function showDeviceDetails(deviceId) {
    try {
        document.getElementById('device-details-loading').style.display = 'block';
        document.getElementById('device-details-content').style.display = 'none';
        
        // Reset tabs
        const tabs = document.querySelectorAll('#deviceDetailsModal .nav-link');
        tabs.forEach(tab => tab.classList.remove('active'));
        tabs[0].classList.add('active');
        
        const tabContent = document.querySelectorAll('#deviceDetailsModal .tab-content .tab-pane');
        tabContent.forEach(content => content.classList.remove('show', 'active'));
        document.getElementById('overview-tab').classList.add('show', 'active');
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('deviceDetailsModal'));
        modal.show();
        
        const apiClient = new ApiClient();
        const deviceResponse = await apiClient.getDevice(deviceId);
        
        if (!deviceResponse.success) {
            throw new Error(deviceResponse.message || 'Không thể tải thông tin thiết bị');
        }
        
        // Get device metrics
        const metricsResponse = await apiClient.getDeviceMetrics(deviceId);
        
        // Update device info
        updateSystemInfo(deviceResponse.device, metricsResponse.metrics);
        
        // Get interfaces
        const interfacesResponse = await apiClient.getDeviceInterfaces(deviceId);
        if (interfacesResponse.success) {
            updateInterfaces(interfacesResponse.interfaces);
        }
        
        // Get clients
        const clientsResponse = await apiClient.getDeviceClients(deviceId);
        if (clientsResponse.success) {
            updateClients(clientsResponse.clients);
        }
        
        // Set device ID for command modal
        document.getElementById('command-device-id').value = deviceId;
        
        document.getElementById('device-details-loading').style.display = 'none';
        document.getElementById('device-details-content').style.display = 'block';
    } catch (error) {
        console.error('Error loading device details:', error);
        showError(error.message || 'Không thể tải thông tin thiết bị');
        document.getElementById('device-details-loading').style.display = 'none';
    }
}

/**
 * Update system info in device details modal
 */
function updateSystemInfo(device, metrics) {
    // Set device name in header
    document.getElementById('device-details-title').textContent = device.name;
    
    // System info
    document.getElementById('device-ip-address').textContent = device.ip_address;
    document.getElementById('device-model-info').textContent = device.model || 'Unknown';
    document.getElementById('device-location-info').textContent = device.location || '-';
    
    // Status
    const statusBadge = document.getElementById('device-status-badge');
    if (device.status === 'online') {
        statusBadge.className = 'badge bg-success';
        statusBadge.textContent = 'Online';
    } else {
        statusBadge.className = 'badge bg-danger';
        statusBadge.textContent = 'Offline';
    }
    
    // Resource usage
    if (metrics) {
        updateResourceUsage(metrics);
    }
}

/**
 * Update resource usage in device details modal
 */
function updateResourceUsage(metrics) {
    // CPU info
    if (metrics.cpu) {
        document.getElementById('cpu-usage-value').textContent = `${metrics.cpu.usage || 0}%`;
        document.getElementById('cpu-usage-progress').style.width = `${metrics.cpu.usage || 0}%`;
        document.getElementById('cpu-load-value').textContent = `${metrics.cpu.load1 || 0} / ${metrics.cpu.load5 || 0} / ${metrics.cpu.load15 || 0}`;
        
        // Set color based on usage
        const cpuProgress = document.getElementById('cpu-usage-progress');
        if (metrics.cpu.usage > 80) {
            cpuProgress.className = 'progress-bar bg-danger';
        } else if (metrics.cpu.usage > 60) {
            cpuProgress.className = 'progress-bar bg-warning';
        } else {
            cpuProgress.className = 'progress-bar bg-info';
        }
    }
    
    // Memory info
    if (metrics.memory) {
        document.getElementById('memory-usage-value').textContent = `${metrics.memory.usage || 0}%`;
        document.getElementById('memory-usage-progress').style.width = `${metrics.memory.usage || 0}%`;
        document.getElementById('memory-used-value').textContent = `${formatBytes(metrics.memory.used || 0)} / ${formatBytes(metrics.memory.total || 0)}`;
        
        // Set color based on usage
        const memoryProgress = document.getElementById('memory-usage-progress');
        if (metrics.memory.usage > 80) {
            memoryProgress.className = 'progress-bar bg-danger';
        } else if (metrics.memory.usage > 60) {
            memoryProgress.className = 'progress-bar bg-warning';
        } else {
            memoryProgress.className = 'progress-bar bg-info';
        }
    }
    
    // Disk info
    if (metrics.disk) {
        document.getElementById('disk-usage-value').textContent = `${metrics.disk.usage || 0}%`;
        document.getElementById('disk-usage-progress').style.width = `${metrics.disk.usage || 0}%`;
        document.getElementById('disk-used-value').textContent = `${formatBytes(metrics.disk.used || 0)} / ${formatBytes(metrics.disk.total || 0)}`;
        
        // Set color based on usage
        const diskProgress = document.getElementById('disk-usage-progress');
        if (metrics.disk.usage > 80) {
            diskProgress.className = 'progress-bar bg-danger';
        } else if (metrics.disk.usage > 60) {
            diskProgress.className = 'progress-bar bg-warning';
        } else {
            diskProgress.className = 'progress-bar bg-info';
        }
    }
    
    // System info
    if (metrics.system) {
        document.getElementById('system-version-value').textContent = metrics.system.os_version || '-';
        document.getElementById('system-uptime-value').textContent = metrics.system.uptime || '-';
        document.getElementById('system-board-value').textContent = metrics.system.board_name || '-';
        document.getElementById('system-firmware-value').textContent = metrics.system.firmware || '-';
    }
}

/**
 * Update interfaces table in device details modal
 */
function updateInterfaces(data) {
    const table = document.getElementById('interfaces-table-body');
    table.innerHTML = '';
    
    if (!data || data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">Không có interfaces</td>
            </tr>
        `;
        return;
    }
    
    data.forEach(iface => {
        const row = document.createElement('tr');
        
        const statusClass = iface.running ? 'status-active' : 'status-inactive';
        
        row.innerHTML = `
            <td>${iface.name}</td>
            <td>${iface.type || '-'}</td>
            <td>
                <span class="status-circle ${statusClass}"></span>
                ${iface.running ? 'Up' : 'Down'}
            </td>
            <td>${iface.mac_address || '-'}</td>
            <td>${iface.ip_address || '-'}</td>
            <td>
                <div class="d-flex">
                    <div class="me-2">↓ ${formatTraffic(iface.rx_byte ? iface.rx_byte * 8 : 0)}</div>
                    <div>↑ ${formatTraffic(iface.tx_byte ? iface.tx_byte * 8 : 0)}</div>
                </div>
            </td>
        `;
        
        table.appendChild(row);
    });
}

/**
 * Update clients table in device details modal
 */
function updateClients(data) {
    const table = document.getElementById('clients-table-body');
    table.innerHTML = '';
    
    if (!data || data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có clients</td>
            </tr>
        `;
        return;
    }
    
    data.forEach(client => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${client.hostname || '-'}</td>
            <td>${client.mac_address || '-'}</td>
            <td>${client.ip_address || '-'}</td>
            <td>${client.interface || '-'}</td>
            <td>${client.connection_type || '-'}</td>
        `;
        
        table.appendChild(row);
    });
}

/**
 * Run command on device
 */
async function runCommand() {
    try {
        const deviceId = document.getElementById('command-device-id').value;
        const command = document.getElementById('command-input').value;
        
        if (!command) {
            throw new Error('Vui lòng nhập lệnh');
        }
        
        document.getElementById('command-result').innerHTML = 'Đang chạy lệnh...';
        document.getElementById('runCommandBtn').disabled = true;
        
        const apiClient = new ApiClient();
        const response = await apiClient.runCommand(deviceId, command);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể chạy lệnh');
        }
        
        // Process and display result
        let resultOutput = '';
        
        if (Array.isArray(response.result)) {
            response.result.forEach(item => {
                resultOutput += '<div class="command-result-item">';
                
                if (typeof item === 'object') {
                    for (const [key, value] of Object.entries(item)) {
                        resultOutput += `<div><span class="command-result-key">${key}:</span> ${value}</div>`;
                    }
                } else {
                    resultOutput += item;
                }
                
                resultOutput += '</div>';
            });
        } else if (typeof response.result === 'object') {
            for (const [key, value] of Object.entries(response.result)) {
                resultOutput += `<div><span class="command-result-key">${key}:</span> ${value}</div>`;
            }
        } else {
            resultOutput = response.result;
        }
        
        document.getElementById('command-result').innerHTML = resultOutput || 'Lệnh được thực hiện thành công';
    } catch (error) {
        console.error('Error running command:', error);
        document.getElementById('command-result').innerHTML = `<div class="text-danger">${error.message || 'Không thể chạy lệnh'}</div>`;
    } finally {
        document.getElementById('runCommandBtn').disabled = false;
    }
}

/**
 * Backup device configuration
 */
async function backupConfig() {
    try {
        const deviceId = document.getElementById('command-device-id').value;
        
        document.getElementById('backupConfigBtn').disabled = true;
        document.getElementById('command-result').innerHTML = 'Đang tạo backup...';
        
        const apiClient = new ApiClient();
        const response = await apiClient.backupDevice(deviceId);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tạo backup');
        }
        
        document.getElementById('command-result').innerHTML = `
            <div class="alert alert-success">
                Đã tạo backup thành công.
                ${response.download_url ? `<a href="${response.download_url}" class="alert-link" target="_blank">Tải xuống</a>` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Error backing up device:', error);
        document.getElementById('command-result').innerHTML = `<div class="text-danger">${error.message || 'Không thể tạo backup'}</div>`;
    } finally {
        document.getElementById('backupConfigBtn').disabled = false;
    }
}

/**
 * Restore device configuration
 */
function restoreConfig() {
    alert('Chức năng đang được phát triển');
}

/**
 * Helper function to format bytes
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Helper function to format traffic
 */
function formatTraffic(bitsPerSecond) {
    if (bitsPerSecond === 0 || bitsPerSecond === undefined || bitsPerSecond === null) {
        return '0 bps';
    }
    
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[Math.min(i, sizes.length - 1)];
}

/**
 * Display error message
 */
function showError(message) {
    toast.showError(message);
}

/**
 * Display success message
 */
function showSuccess(message) {
    toast.showSuccess(message);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDevices();
});