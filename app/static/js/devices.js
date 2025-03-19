/**
 * MikroTik Monitor - Quản lý thiết bị
 * Xử lý trang quản lý thiết bị và các chức năng liên quan
 */

// Biến lưu trữ toàn cục
let devices = [];
let chartInstances = {};
let viewMode = 'list'; // 'list' hoặc 'grid'

/**
 * Khởi tạo trang quản lý thiết bị
 */
function initializeDevices() {
    // Thiết lập các sự kiện
    setupEventListeners();
    
    // Tải danh sách thiết bị
    loadDevices();
}

/**
 * Thiết lập tất cả các sự kiện
 */
function setupEventListeners() {
    // Sự kiện thay đổi chế độ xem
    document.getElementById('gridViewBtn').addEventListener('click', function() {
        viewMode = 'grid';
        updateViewModeButtons();
    });
    
    document.getElementById('listViewBtn').addEventListener('click', function() {
        viewMode = 'list';
        updateViewModeButtons();
    });
    
    // Sự kiện lọc danh sách thiết bị
    document.getElementById('deviceSearch').addEventListener('input', filterDevices);
    document.getElementById('modelFilter').addEventListener('change', filterDevices);
    document.getElementById('statusFilter').addEventListener('change', filterDevices);
    
    // Sự kiện thêm thiết bị
    document.getElementById('saveDeviceBtn').addEventListener('click', saveDevice);
    
    // Sự kiện quét mạng
    document.getElementById('startScanBtn').addEventListener('click', startNetworkScan);
    document.getElementById('addSelectedDevicesBtn').addEventListener('click', addSelectedDevices);
    
    // Sự kiện nhấp vào tab thiết bị
    const deviceTabs = document.querySelectorAll('.nav-link[data-bs-toggle="pill"]');
    deviceTabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            // Nếu không phải tab "Tất cả thiết bị", tải dữ liệu cho tab cụ thể
            if (e.target.id !== 'all-devices-tab') {
                const tabType = e.target.id.split('-')[0]; // Lấy phần 'routers', 'switches', 'wireless'
                loadDevicesByType(tabType);
            }
        });
    });
}

/**
 * Cập nhật nút chuyển đổi chế độ xem
 */
function updateViewModeButtons() {
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const deviceListView = document.getElementById('deviceListView');
    const deviceGridView = document.getElementById('deviceGridView');
    
    if (viewMode === 'grid') {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        deviceListView.style.display = 'none';
        deviceGridView.style.display = 'block';
    } else {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        deviceListView.style.display = 'block';
        deviceGridView.style.display = 'none';
    }
}

/**
 * Tải danh sách thiết bị từ API
 */
async function loadDevices() {
    try {
        const response = await fetch('/api/devices', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải danh sách thiết bị');
        }
        
        const data = await response.json();
        devices = data; // Lưu vào biến toàn cục để dùng cho việc lọc
        
        // Cập nhật giao diện với dữ liệu thiết bị
        updateDeviceList(devices);
        updateDeviceGrid(devices);
        
        // Thêm nút QR code vào các thẻ thiết bị (card) và các hàng bảng
        addQRCodeButtons(
            document.querySelectorAll('.device-card'),
            card => card.getAttribute('data-device-id'),
            card => card.querySelector('.card-title').textContent
        );
        
        // Khởi tạo QR code
        initializeQRCodes();
        
    } catch (error) {
        console.error('Error loading devices:', error);
        showError('Đã xảy ra lỗi khi tải danh sách thiết bị');
    }
}

/**
 * Tải thiết bị theo loại cụ thể
 * @param {string} type - Loại thiết bị (routers, switches, wireless)
 */
async function loadDevicesByType(type) {
    try {
        const response = await fetch(`/api/devices?type=${type}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Không thể tải danh sách thiết bị loại ${type}`);
        }
        
        const data = await response.json();
        
        // Cập nhật bảng thiết bị tương ứng
        updateDeviceTable(type, data);
        
    } catch (error) {
        console.error(`Error loading ${type}:`, error);
        showError(`Đã xảy ra lỗi khi tải danh sách thiết bị loại ${type}`);
    }
}

/**
 * Cập nhật bảng thiết bị theo loại
 * @param {string} type - Loại thiết bị (routers, switches, wireless)
 * @param {array} deviceList - Danh sách thiết bị
 */
function updateDeviceTable(type, deviceList) {
    const tableId = `${type}Table`;
    const tableBody = document.querySelector(`#${tableId} tbody`);
    
    if (!tableBody) return;
    
    if (!deviceList || deviceList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">Không có thiết bị nào</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    deviceList.forEach(device => {
        const statusClass = device.status === 'online' ? 'device-status-online' : 
                           (device.status === 'warning' ? 'device-status-warning' : 'device-status-offline');
        
        tableContent += `
            <tr data-device-id="${device.id}">
                <td>
                    <strong>${device.name}</strong>
                </td>
                <td>${device.ip_address}</td>
                <td>${device.model || 'N/A'}</td>
                <td>${device.version || 'N/A'}</td>
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
                    <span class="device-status-dot ${statusClass}"></span>
                    ${device.status === 'online' ? 'Online' : 
                     (device.status === 'warning' ? 'Warning' : 'Offline')}
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            <i class="fas fa-cog"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item view-device" href="#" data-device-id="${device.id}">
                                <i class="fas fa-eye"></i> Xem chi tiết
                            </a></li>
                            <li><a class="dropdown-item edit-device" href="#" data-device-id="${device.id}">
                                <i class="fas fa-edit"></i> Chỉnh sửa
                            </a></li>
                            <li><a class="dropdown-item qrcode-device" href="#" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-qrcode"></i> QR Code
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item delete-device" href="#" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-trash-alt"></i> Xóa
                            </a></li>
                        </ul>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
    
    // Thêm event listeners cho các nút hành động
    setupDeviceActionHandlers(tableBody);
}

/**
 * Cập nhật danh sách thiết bị với dữ liệu
 * @param {array} deviceList - Danh sách thiết bị
 */
function updateDeviceList(deviceList) {
    const tableBody = document.querySelector('#devicesTable tbody');
    
    if (!deviceList || deviceList.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">Không có thiết bị nào</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    deviceList.forEach(device => {
        const statusClass = device.status === 'online' ? 'device-status-online' : 
                           (device.status === 'warning' ? 'device-status-warning' : 'device-status-offline');
        
        tableContent += `
            <tr data-device-id="${device.id}">
                <td>
                    <strong>${device.name}</strong>
                </td>
                <td>${device.ip_address}</td>
                <td>${device.model || 'N/A'}</td>
                <td>${device.version || 'N/A'}</td>
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
                    <span class="device-status-dot ${statusClass}"></span>
                    ${device.status === 'online' ? 'Online' : 
                     (device.status === 'warning' ? 'Warning' : 'Offline')}
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            <i class="fas fa-cog"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item view-device" href="#" data-device-id="${device.id}">
                                <i class="fas fa-eye"></i> Xem chi tiết
                            </a></li>
                            <li><a class="dropdown-item edit-device" href="#" data-device-id="${device.id}">
                                <i class="fas fa-edit"></i> Chỉnh sửa
                            </a></li>
                            <li><a class="dropdown-item qrcode-device" href="#" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-qrcode"></i> QR Code
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item delete-device" href="#" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-trash-alt"></i> Xóa
                            </a></li>
                        </ul>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
    
    // Thêm event listeners cho các nút hành động
    setupDeviceActionHandlers(tableBody);
}

/**
 * Cập nhật lưới thiết bị với dữ liệu
 * @param {array} deviceList - Danh sách thiết bị
 */
function updateDeviceGrid(deviceList) {
    const gridContainer = document.getElementById('devicesGrid');
    
    if (!deviceList || deviceList.length === 0) {
        gridContainer.innerHTML = `
            <div class="col-12 text-center p-5">
                <i class="fas fa-server fa-3x text-muted mb-3"></i>
                <p>Không có thiết bị nào</p>
            </div>
        `;
        return;
    }
    
    let gridContent = '';
    
    deviceList.forEach(device => {
        const statusClass = device.status === 'online' ? 'device-status-online' : 
                           (device.status === 'warning' ? 'device-status-warning' : 'device-status-offline');
        
        const statusText = device.status === 'online' ? 'Online' : 
                          (device.status === 'warning' ? 'Warning' : 'Offline');
        
        let iconClass = 'fas fa-server';
        if (device.type === 'router') {
            iconClass = 'fas fa-router';
        } else if (device.type === 'switch') {
            iconClass = 'fas fa-network-wired';
        } else if (device.type === 'wireless') {
            iconClass = 'fas fa-wifi';
        }
        
        gridContent += `
            <div class="col-xl-3 col-md-4 col-sm-6 mb-4">
                <div class="card device-card h-100" data-device-id="${device.id}">
                    <div class="card-body text-center">
                        <div class="device-icon">
                            <i class="${iconClass}"></i>
                        </div>
                        <h5 class="card-title">${device.name}</h5>
                        <p class="card-text text-muted">${device.model || 'N/A'}</p>
                        <p class="card-text">${device.ip_address}</p>
                        
                        <div class="mb-2">
                            <span class="device-status-dot ${statusClass}"></span>
                            <span>${statusText}</span>
                        </div>
                        
                        <div class="text-start mb-3">
                            <small class="d-block">CPU: ${device.cpu_load || 0}%</small>
                            <div class="progress mb-2" style="height: 4px;">
                                <div class="progress-bar" role="progressbar" style="width: ${device.cpu_load || 0}%"></div>
                            </div>
                            
                            <small class="d-block">Memory: ${device.memory_usage || 0}%</small>
                            <div class="progress" style="height: 4px;">
                                <div class="progress-bar bg-success" role="progressbar" style="width: ${device.memory_usage || 0}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent border-top-0">
                        <div class="btn-group d-flex">
                            <button type="button" class="btn btn-sm btn-outline-primary view-device" data-device-id="${device.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary edit-device" data-device-id="${device.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-info qrcode-device" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger delete-device" data-device-id="${device.id}" data-device-name="${device.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    gridContainer.innerHTML = gridContent;
    
    // Thêm event listeners cho các nút hành động
    setupDeviceActionHandlers(gridContainer);
}

/**
 * Thiết lập các sự kiện cho nút hành động thiết bị
 * @param {HTMLElement} container - Container chứa các nút hành động
 */
function setupDeviceActionHandlers(container) {
    // Event listener cho nút xem chi tiết
    container.querySelectorAll('.view-device').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const deviceId = this.getAttribute('data-device-id');
            showDeviceDetails(deviceId);
        });
    });
    
    // Event listener cho nút chỉnh sửa
    container.querySelectorAll('.edit-device').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const deviceId = this.getAttribute('data-device-id');
            showEditDeviceModal(deviceId);
        });
    });
    
    // Event listener cho nút QR code
    container.querySelectorAll('.qrcode-device').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const deviceId = this.getAttribute('data-device-id');
            const deviceName = this.getAttribute('data-device-name');
            generateAndDisplayQRCode(deviceId, deviceName);
        });
    });
    
    // Event listener cho nút xóa
    container.querySelectorAll('.delete-device').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const deviceId = this.getAttribute('data-device-id');
            const deviceName = this.getAttribute('data-device-name');
            showDeleteDeviceModal(deviceId, deviceName);
        });
    });
}

/**
 * Lọc danh sách thiết bị theo các bộ lọc
 */
function filterDevices() {
    const searchTerm = document.getElementById('deviceSearch').value.toLowerCase();
    const modelFilter = document.getElementById('modelFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    const filteredDevices = devices.filter(device => {
        // Lọc theo từ khóa tìm kiếm
        const matchSearch = device.name.toLowerCase().includes(searchTerm) || 
                           device.ip_address.toLowerCase().includes(searchTerm) ||
                           (device.model && device.model.toLowerCase().includes(searchTerm));
        
        // Lọc theo model
        const matchModel = modelFilter === 'all' || 
                          (device.model && device.model.includes(modelFilter));
        
        // Lọc theo trạng thái
        const matchStatus = statusFilter === 'all' || device.status === statusFilter;
        
        return matchSearch && matchModel && matchStatus;
    });
    
    // Cập nhật giao diện với thiết bị đã lọc
    updateDeviceList(filteredDevices);
    updateDeviceGrid(filteredDevices);
}

/**
 * Lưu thiết bị mới
 */
async function saveDevice() {
    try {
        // Lấy dữ liệu từ form
        const name = document.getElementById('deviceName').value;
        const ip = document.getElementById('deviceIP').value;
        const username = document.getElementById('deviceUsername').value;
        const password = document.getElementById('devicePassword').value;
        const type = document.getElementById('deviceType').value;
        const port = document.getElementById('devicePort').value;
        const useSSL = document.getElementById('deviceUseSSL').checked;
        
        // Kiểm tra dữ liệu
        if (!name || !ip) {
            showError('Vui lòng nhập đầy đủ thông tin thiết bị');
            return;
        }
        
        // Chuẩn bị dữ liệu gửi lên API
        const deviceData = {
            name: name,
            ip_address: ip,
            username: username,
            password: password,
            type: type,
            port: parseInt(port),
            use_ssl: useSSL
        };
        
        // Gửi request tạo thiết bị mới
        const response = await fetch('/api/devices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            },
            body: JSON.stringify(deviceData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Không thể tạo thiết bị mới');
        }
        
        // Đóng modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDeviceModal'));
        modal.hide();
        
        // Hiển thị thông báo thành công
        showSuccess('Đã thêm thiết bị mới thành công');
        
        // Tải lại danh sách thiết bị
        loadDevices();
        
        // Reset form
        document.getElementById('addDeviceForm').reset();
        
    } catch (error) {
        console.error('Error saving device:', error);
        showError(error.message || 'Đã xảy ra lỗi khi thêm thiết bị mới');
    }
}

/**
 * Hiển thị modal chỉnh sửa thiết bị
 * @param {number} deviceId - ID của thiết bị
 */
async function showEditDeviceModal(deviceId) {
    try {
        // Lấy thông tin thiết bị từ API
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
        
        // Điền thông tin vào form
        document.getElementById('editDeviceId').value = device.id;
        document.getElementById('editDeviceName').value = device.name;
        document.getElementById('editDeviceIP').value = device.ip_address;
        document.getElementById('editDeviceUsername').value = device.username;
        document.getElementById('editDeviceType').value = device.type || 'router';
        document.getElementById('editDevicePort').value = device.port || 8728;
        document.getElementById('editDeviceUseSSL').checked = device.use_ssl || false;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading device details:', error);
        showError('Đã xảy ra lỗi khi tải thông tin thiết bị');
    }
}

/**
 * Cập nhật thiết bị
 */
async function updateDevice() {
    try {
        // Lấy dữ liệu từ form
        const deviceId = document.getElementById('editDeviceId').value;
        const name = document.getElementById('editDeviceName').value;
        const ip = document.getElementById('editDeviceIP').value;
        const username = document.getElementById('editDeviceUsername').value;
        const password = document.getElementById('editDevicePassword').value;
        const type = document.getElementById('editDeviceType').value;
        const port = document.getElementById('editDevicePort').value;
        const useSSL = document.getElementById('editDeviceUseSSL').checked;
        
        // Kiểm tra dữ liệu
        if (!name || !ip) {
            showError('Vui lòng nhập đầy đủ thông tin thiết bị');
            return;
        }
        
        // Chuẩn bị dữ liệu gửi lên API
        const deviceData = {
            name: name,
            ip_address: ip,
            username: username,
            type: type,
            port: parseInt(port),
            use_ssl: useSSL
        };
        
        // Thêm mật khẩu nếu có
        if (password) {
            deviceData.password = password;
        }
        
        // Gửi request cập nhật thiết bị
        const response = await fetch(`/api/devices/${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            },
            body: JSON.stringify(deviceData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Không thể cập nhật thiết bị');
        }
        
        // Đóng modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editDeviceModal'));
        modal.hide();
        
        // Hiển thị thông báo thành công
        showSuccess('Đã cập nhật thiết bị thành công');
        
        // Tải lại danh sách thiết bị
        loadDevices();
        
    } catch (error) {
        console.error('Error updating device:', error);
        showError(error.message || 'Đã xảy ra lỗi khi cập nhật thiết bị');
    }
}

/**
 * Hiển thị modal xác nhận xóa thiết bị
 * @param {number} deviceId - ID của thiết bị
 * @param {string} deviceName - Tên của thiết bị
 */
function showDeleteDeviceModal(deviceId, deviceName) {
    document.getElementById('deleteDeviceId').value = deviceId;
    document.getElementById('deleteDeviceName').textContent = deviceName;
    
    // Bắt sự kiện nút xác nhận xóa
    document.getElementById('confirmDeleteBtn').onclick = deleteDevice;
    
    // Hiển thị modal
    const modal = new bootstrap.Modal(document.getElementById('deleteDeviceModal'));
    modal.show();
}

/**
 * Xóa thiết bị
 */
async function deleteDevice() {
    try {
        const deviceId = document.getElementById('deleteDeviceId').value;
        
        // Gửi request xóa thiết bị
        const response = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể xóa thiết bị');
        }
        
        // Đóng modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteDeviceModal'));
        modal.hide();
        
        // Hiển thị thông báo thành công
        showSuccess('Đã xóa thiết bị thành công');
        
        // Tải lại danh sách thiết bị
        loadDevices();
        
    } catch (error) {
        console.error('Error deleting device:', error);
        showError('Đã xảy ra lỗi khi xóa thiết bị');
    }
}

/**
 * Bắt đầu quét mạng
 */
async function startNetworkScan() {
    try {
        const subnet = document.getElementById('scanSubnet').value;
        
        if (!subnet) {
            showError('Vui lòng nhập subnet để quét');
            return;
        }
        
        // Hiển thị trạng thái quét
        const scanProgress = document.getElementById('scanProgress');
        scanProgress.style.display = 'block';
        
        // Làm sạch bảng kết quả
        document.querySelector('#scanResultsTable tbody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Đang quét mạng...</p>
                </td>
            </tr>
        `;
        
        // Cập nhật thanh tiến trình
        updateScanProgress(0);
        
        // Gửi request quét mạng
        const response = await fetch('/api/network/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            },
            body: JSON.stringify({ subnet: subnet })
        });
        
        if (!response.ok) {
            throw new Error('Không thể thực hiện quét mạng');
        }
        
        // Giả lập tiến trình quét
        simulateScanProgress();
        
        const results = await response.json();
        
        // Cập nhật tiến trình hoàn thành
        updateScanProgress(100);
        
        // Hiển thị kết quả quét
        updateScanResults(results);
        
    } catch (error) {
        console.error('Error scanning network:', error);
        showError('Đã xảy ra lỗi khi quét mạng');
        
        // Ẩn trạng thái quét
        document.getElementById('scanProgress').style.display = 'none';
        
        // Hiển thị thông báo lỗi trong bảng
        document.querySelector('#scanResultsTable tbody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">
                    <i class="fas fa-exclamation-circle"></i> Lỗi: ${error.message || 'Không thể quét mạng'}
                </td>
            </tr>
        `;
    }
}

/**
 * Cập nhật tiến trình quét
 * @param {number} percent - Phần trăm hoàn thành
 */
function updateScanProgress(percent) {
    document.getElementById('scanProgressBar').style.width = `${percent}%`;
    document.getElementById('scanProgressPercent').textContent = `${Math.floor(percent)}%`;
}

/**
 * Giả lập tiến trình quét mạng
 */
function simulateScanProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress > 90) {
            clearInterval(interval);
            return;
        }
        updateScanProgress(progress);
    }, 200);
}

/**
 * Cập nhật kết quả quét mạng
 * @param {array} results - Kết quả quét mạng
 */
function updateScanResults(results) {
    const tableBody = document.querySelector('#scanResultsTable tbody');
    
    if (!results || results.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">Không tìm thấy thiết bị nào trong mạng</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    results.forEach(device => {
        const ports = device.open_ports ? device.open_ports.join(', ') : 'N/A';
        const isMikrotik = device.is_mikrotik ? 'MikroTik' : (device.vendor || 'Không xác định');
        
        tableContent += `
            <tr>
                <td>${device.ip_address}</td>
                <td>${device.hostname || 'N/A'}</td>
                <td>${device.mac_address || 'N/A'}</td>
                <td>${isMikrotik}</td>
                <td>${ports}</td>
                <td>
                    <div class="form-check">
                        <input class="form-check-input device-select" type="checkbox" value="${device.ip_address}" 
                            id="device-${device.ip_address}" ${device.is_mikrotik ? 'checked' : ''}>
                        <label class="form-check-label" for="device-${device.ip_address}">
                            Thêm
                        </label>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
}

/**
 * Thêm thiết bị đã chọn từ kết quả quét
 */
function addSelectedDevices() {
    const selectedDevices = document.querySelectorAll('.device-select:checked');
    
    if (selectedDevices.length === 0) {
        showError('Vui lòng chọn ít nhất một thiết bị để thêm');
        return;
    }
    
    // Đóng modal quét mạng
    const modal = bootstrap.Modal.getInstance(document.getElementById('networkScanModal'));
    modal.hide();
    
    // Mở modal thêm thiết bị với IP đã điền sẵn
    const firstDeviceIP = selectedDevices[0].value;
    document.getElementById('deviceIP').value = firstDeviceIP;
    
    // Mở modal thêm thiết bị
    const addModal = new bootstrap.Modal(document.getElementById('addDeviceModal'));
    addModal.show();
    
    // Hiển thị thông báo
    if (selectedDevices.length > 1) {
        showInfo(`Đã chọn ${selectedDevices.length} thiết bị. Vui lòng thêm từng thiết bị.`);
    }
}

/**
 * Hiển thị chi tiết thiết bị
 * @param {number} deviceId - ID của thiết bị
 */
async function showDeviceDetails(deviceId) {
    try {
        // Lấy thông tin thiết bị từ API
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
        
        // Cập nhật thông tin thiết bị trong modal
        updateSystemInfo(device, metrics);
        
        // Cập nhật biểu đồ tài nguyên
        updateResourceUsage(metrics);
        
        // Lấy dữ liệu interfaces
        const interfacesResponse = await fetch(`/api/devices/${deviceId}/interfaces`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (interfacesResponse.ok) {
            const interfaces = await interfacesResponse.json();
            updateInterfaces(interfaces);
        }
        
        // Lấy dữ liệu clients
        const clientsResponse = await fetch(`/api/devices/${deviceId}/clients`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (clientsResponse.ok) {
            const clients = await clientsResponse.json();
            updateClients(clients);
        }
        
        // Lấy dữ liệu traffic
        loadTrafficData(deviceId);
        
        // Cập nhật links
        document.getElementById('detailsMonitoringLink').href = `/monitoring?device=${deviceId}`;
        
        // Thiết lập sự kiện cho nút backup
        document.getElementById('backupDeviceBtn').onclick = () => backupConfig(deviceId);
        
        // Thiết lập sự kiện cho nút QR Code
        document.getElementById('qrCodeDeviceBtn').onclick = () => generateAndDisplayQRCode(deviceId, device.name);
        
        // Thiết lập sự kiện cho nút chạy lệnh
        document.getElementById('runCommandBtn').onclick = runCommand;
        
        // Cập nhật ID thiết bị cho lệnh CLI
        document.getElementById('runCommandBtn').setAttribute('data-device-id', deviceId);
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('deviceDetailsModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading device details:', error);
        showError('Đã xảy ra lỗi khi tải chi tiết thiết bị');
    }
}

/**
 * Cập nhật thông tin hệ thống trong modal chi tiết
 * @param {object} device - Thông tin thiết bị
 * @param {object} metrics - Dữ liệu metrics
 */
function updateSystemInfo(device, metrics) {
    document.getElementById('detailsName').textContent = device.name;
    document.getElementById('detailsModel').textContent = device.model || 'N/A';
    document.getElementById('detailsSerial').textContent = device.serial_number || 'N/A';
    document.getElementById('detailsVersion').textContent = device.version || 'N/A';
    document.getElementById('detailsIP').textContent = device.ip_address;
    document.getElementById('detailsUptime').textContent = formatUptime(device.uptime);
    
    // Cập nhật tiêu đề modal
    document.getElementById('deviceDetailsModalLabel').textContent = `Chi tiết thiết bị: ${device.name}`;
}

/**
 * Cập nhật thông tin tài nguyên trong modal chi tiết
 * @param {object} metrics - Dữ liệu metrics
 */
function updateResourceUsage(metrics) {
    const cpuUsage = metrics.cpu_load || 0;
    const memoryUsage = metrics.memory_usage || 0;
    const diskUsage = metrics.disk_usage || 0;
    const temperature = metrics.temperature || 0;
    
    // Cập nhật thanh tiến trình
    document.getElementById('detailsCpuValue').textContent = `${cpuUsage}%`;
    document.getElementById('detailsCpuBar').style.width = `${cpuUsage}%`;
    
    document.getElementById('detailsMemoryValue').textContent = `${memoryUsage}%`;
    document.getElementById('detailsMemoryBar').style.width = `${memoryUsage}%`;
    
    document.getElementById('detailsDiskValue').textContent = `${diskUsage}%`;
    document.getElementById('detailsDiskBar').style.width = `${diskUsage}%`;
    
    document.getElementById('detailsTemperatureValue').textContent = temperature ? `${temperature}°C` : 'N/A';
    document.getElementById('detailsTemperatureBar').style.width = temperature ? `${Math.min(temperature, 100)}%` : '0%';
    
    // Cập nhật hoặc tạo biểu đồ tài nguyên
    createResourceCharts(metrics);
}

/**
 * Tạo các biểu đồ tài nguyên
 * @param {object} metrics - Dữ liệu metrics
 */
function createResourceCharts(metrics) {
    // Tạo hoặc cập nhật biểu đồ CPU
    createOrUpdateChart('cpuDetailChart', 'CPU Usage (%)', metrics.cpu_history || [], '#4e73df');
    
    // Tạo hoặc cập nhật biểu đồ Memory
    createOrUpdateChart('memoryDetailChart', 'Memory Usage (%)', metrics.memory_history || [], '#1cc88a');
    
    // Tạo hoặc cập nhật biểu đồ Disk
    createOrUpdateChart('diskDetailChart', 'Disk Usage (%)', metrics.disk_history || [], '#36b9cc');
    
    // Tạo hoặc cập nhật biểu đồ Temperature
    createOrUpdateChart('temperatureDetailChart', 'Temperature (°C)', metrics.temperature_history || [], '#f6c23e');
}

/**
 * Tạo hoặc cập nhật biểu đồ
 * @param {string} canvasId - ID của canvas
 * @param {string} label - Nhãn biểu đồ
 * @param {array} data - Dữ liệu biểu đồ
 * @param {string} color - Màu sắc
 */
function createOrUpdateChart(canvasId, label, data, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Nếu đã có biểu đồ, hủy để tạo lại
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    
    // Chuẩn bị dữ liệu
    const labels = data.map(item => item.time || '');
    const values = data.map(item => item.value || 0);
    
    // Tạo biểu đồ
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: color,
                borderColor: color,
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + (label.includes('°C') ? '°C' : '%');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Cập nhật bảng interfaces
 * @param {array} data - Dữ liệu interfaces
 */
function updateInterfaces(data) {
    const tableBody = document.querySelector('#deviceInterfacesTable tbody');
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">Không có interface nào</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    data.forEach(iface => {
        const statusClass = iface.status === 'up' ? 'text-success' : 'text-danger';
        const status = iface.status === 'up' ? 'Up' : 'Down';
        
        tableContent += `
            <tr>
                <td>${iface.name}</td>
                <td>${iface.type || 'N/A'}</td>
                <td>${iface.mac_address || 'N/A'}</td>
                <td class="${statusClass}">${status}</td>
                <td>${iface.mtu || 'N/A'}</td>
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
 * Cập nhật bảng clients
 * @param {array} data - Dữ liệu clients
 */
function updateClients(data) {
    const tableBody = document.querySelector('#deviceClientsTable tbody');
    
    if (!data || data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Không có client nào kết nối</td>
            </tr>
        `;
        return;
    }
    
    let tableContent = '';
    
    data.forEach(client => {
        tableContent += `
            <tr>
                <td>${client.hostname || 'N/A'}</td>
                <td>${client.mac_address || 'N/A'}</td>
                <td>${client.ip_address || 'N/A'}</td>
                <td>${client.interface || 'N/A'}</td>
                <td>${client.connected_since ? formatTimeAgo(new Date(client.connected_since)) : 'N/A'}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableContent;
}

/**
 * Tải dữ liệu traffic
 * @param {number} deviceId - ID của thiết bị
 */
async function loadTrafficData(deviceId) {
    try {
        const hours = document.getElementById('trafficTimeRange').value || 24;
        
        const response = await fetch(`/api/devices/${deviceId}/traffic?hours=${hours}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải dữ liệu traffic');
        }
        
        const data = await response.json();
        
        // Tạo biểu đồ traffic
        createTrafficChart(data);
        
    } catch (error) {
        console.error('Error loading traffic data:', error);
        // Không hiển thị lỗi để tránh phiền người dùng
    }
}

/**
 * Tạo biểu đồ traffic
 * @param {object} data - Dữ liệu traffic
 */
function createTrafficChart(data) {
    const ctx = document.getElementById('trafficChart').getContext('2d');
    
    // Nếu đã có biểu đồ, hủy để tạo lại
    if (chartInstances['trafficChart']) {
        chartInstances['trafficChart'].destroy();
    }
    
    // Chuẩn bị dữ liệu
    const labels = data.timestamps || [];
    const inData = data.rx_data || [];
    const outData = data.tx_data || [];
    
    // Tạo biểu đồ
    chartInstances['trafficChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Inbound',
                    data: inData,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Outbound',
                    data: outData,
                    borderColor: '#1cc88a',
                    backgroundColor: 'rgba(28, 200, 138, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatTraffic(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatTraffic(value);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Traffic'
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
    
    // Thiết lập sự kiện thay đổi khoảng thời gian
    document.getElementById('trafficTimeRange').addEventListener('change', function() {
        const deviceId = document.querySelector('#deviceDetailsModal').getAttribute('data-device-id');
        loadTrafficData(deviceId);
    });
}

/**
 * Chạy lệnh trên thiết bị
 */
async function runCommand() {
    try {
        const deviceId = this.getAttribute('data-device-id');
        const command = document.getElementById('commandInput').value;
        
        if (!command) {
            document.getElementById('commandOutput').textContent = '# Vui lòng nhập lệnh để chạy';
            return;
        }
        
        // Hiển thị trạng thái đang thực hiện
        document.getElementById('commandOutput').textContent = '# Đang thực hiện lệnh...';
        
        // Gửi request chạy lệnh
        const response = await fetch(`/api/devices/${deviceId}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            },
            body: JSON.stringify({ command: command })
        });
        
        if (!response.ok) {
            throw new Error('Không thể thực hiện lệnh');
        }
        
        const result = await response.json();
        
        // Hiển thị kết quả
        document.getElementById('commandOutput').textContent = result.output || '# Lệnh đã được thực hiện thành công';
        
    } catch (error) {
        console.error('Error running command:', error);
        document.getElementById('commandOutput').textContent = `# Lỗi: ${error.message || 'Không thể thực hiện lệnh'}`;
    }
}

/**
 * Backup cấu hình thiết bị
 * @param {number} deviceId - ID của thiết bị
 */
async function backupConfig(deviceId) {
    try {
        // Hiển thị thông báo đang backup
        showInfo('Đang tạo backup...');
        
        // Gửi request backup
        const response = await fetch(`/api/devices/${deviceId}/backup`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AuthManager.getAccessToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tạo backup');
        }
        
        const result = await response.json();
        
        // Hiển thị thông báo thành công
        showSuccess('Đã tạo backup thành công');
        
        // Nếu có link download, mở trong tab mới
        if (result.download_url) {
            window.open(result.download_url, '_blank');
        }
        
    } catch (error) {
        console.error('Error backing up device:', error);
        showError(error.message || 'Đã xảy ra lỗi khi tạo backup');
    }
}

/**
 * Tạo và hiển thị QR code cho thiết bị
 * @param {number} deviceId - ID của thiết bị
 * @param {string} deviceName - Tên thiết bị
 */
async function generateAndDisplayQRCode(deviceId, deviceName) {
    try {
        // Gọi hàm từ qrcodes.js để tạo QR code
        const qrcodeData = await generateDeviceQRCode(deviceId);
        
        // Hiển thị QR code trong modal
        displayQRCodeModal(qrcodeData.qrcode, `QR Code: ${deviceName}`, deviceName);
        
    } catch (error) {
        console.error('Error generating QR code:', error);
        showError('Đã xảy ra lỗi khi tạo QR code');
    }
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
 * Định dạng bytes
 * @param {number} bytes - Kích thước tính bằng bytes
 * @param {number} decimals - Số chữ số thập phân
 * @returns {string} - Chuỗi đã định dạng
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Định dạng traffic
 * @param {number} bitsPerSecond - Lưu lượng tính bằng bps
 * @returns {string} - Chuỗi đã định dạng
 */
function formatTraffic(bitsPerSecond) {
    if (bitsPerSecond === 0) return '0 bps';
    
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(1000));
    
    return (bitsPerSecond / Math.pow(1000, i)).toFixed(2) + ' ' + units[i];
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
 * Hiển thị thông báo thành công
 * @param {string} message - Thông báo thành công
 */
function showSuccess(message) {
    if (typeof ToastManager !== 'undefined' && ToastManager.showSuccess) {
        ToastManager.showSuccess(message);
    } else {
        alert(message);
    }
}

/**
 * Hiển thị thông báo thông tin
 * @param {string} message - Thông báo thông tin
 */
function showInfo(message) {
    if (typeof ToastManager !== 'undefined' && ToastManager.showInfo) {
        ToastManager.showInfo(message);
    } else {
        alert(message);
    }
}