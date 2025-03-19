/**
 * WebSocket functionality
 * Handles real-time updates and events
 */

// WebSocket connection instance
let socket = null;

/**
 * Initialize WebSocket connection
 */
function setupWebSocket() {
    console.log('Setting up WebSocket connection...');
    
    // Check if SocketIO is available
    if (typeof io === 'undefined') {
        console.error('Socket.IO not available');
        return;
    }
    
    // Get current protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Create WebSocket connection
    socket = io.connect(`${protocol}//${window.location.host}`, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
    });
    
    // Connection events
    socket.on('connect', function() {
        console.log('WebSocket connected');
        showInfo('Đã kết nối đến server');
    });
    
    socket.on('disconnect', function() {
        console.log('WebSocket disconnected');
    });
    
    socket.on('connect_error', function(error) {
        console.error('WebSocket connection error:', error);
    });
    
    socket.on('reconnect_attempt', function(attempt) {
        console.log(`WebSocket reconnection attempt: ${attempt}`);
    });
    
    socket.on('reconnect', function(attempt) {
        console.log(`WebSocket reconnected after ${attempt} attempts`);
        showInfo('Đã kết nối lại đến server');
    });
    
    socket.on('reconnect_error', function(error) {
        console.error('WebSocket reconnection error:', error);
    });
    
    socket.on('reconnect_failed', function() {
        console.error('WebSocket reconnection failed');
        showError('Không thể kết nối lại đến server');
    });
    
    // Device update event
    socket.on('device_update', function(data) {
        handleDeviceUpdateEvent(data);
    });
    
    // Alert event
    socket.on('alert', function(data) {
        handleAlertEvent(data);
    });
    
    // Connection status event
    socket.on('connection_status', function(data) {
        if (data.device_id) {
            // Update device status in UI
            updateDeviceStatus(data.device_id, data.status);
        }
    });
    
    // System notification event
    socket.on('system_notification', function(data) {
        if (data.type === 'error') {
            showError(data.message);
        } else if (data.type === 'warning') {
            showWarning(data.message);
        } else if (data.type === 'success') {
            showSuccess(data.message);
        } else {
            showInfo(data.message);
        }
    });
}

/**
 * Handle device update event
 * @param {object} data - Device update data
 */
function handleDeviceUpdateEvent(data) {
    console.log('Device update event:', data);
    
    // Update device UI if on dashboard
    if (window.location.pathname === '/dashboard') {
        // Refresh dashboard data
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
    }
    
    // Update device UI if on devices page
    if (window.location.pathname === '/devices') {
        // Update device status
        if (data.device_id) {
            if (typeof checkDeviceStatus === 'function') {
                checkDeviceStatus(data.device_id);
            }
            if (typeof checkDeviceGridStatus === 'function') {
                checkDeviceGridStatus(data.device_id);
            }
        }
    }
    
    // Update device UI if on monitoring page
    if (window.location.pathname === '/monitoring') {
        // Update device metrics if viewing this device
        if (data.device_id && window.selectedDeviceId === data.device_id) {
            if (typeof loadDeviceOverview === 'function') {
                loadDeviceOverview(data.device_id);
            }
            if (typeof loadMetrics === 'function') {
                loadMetrics(data.device_id);
            }
        }
    }
    
    // Update device UI if on topology page
    if (window.location.pathname === '/topology') {
        // Update network map
        if (typeof refreshNetworkMap === 'function') {
            refreshNetworkMap();
        }
    }
    
    // Update device UI if on VPN monitoring page
    if (window.location.pathname === '/vpn_monitoring') {
        // Update VPN data if viewing this device
        if (data.device_id && window.vpnSelectedDeviceId === data.device_id) {
            if (typeof loadVpnData === 'function') {
                loadVpnData(data.device_id);
            }
        }
    }
}

/**
 * Handle alert event
 * @param {object} data - Alert data
 */
function handleAlertEvent(data) {
    console.log('Alert event:', data);
    
    // Show notification for the alert
    showAlertNotification(data.alert);
    
    // Update alerts in UI if on dashboard
    if (window.location.pathname === '/dashboard') {
        // Refresh dashboard data
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
    }
    
    // Update alerts in UI if on monitoring page
    if (window.location.pathname === '/monitoring') {
        // Update alerts list
        if (typeof loadRecentAlerts === 'function') {
            loadRecentAlerts();
        }
    }
}

/**
 * Update device status in UI
 * @param {number} deviceId - Device ID
 * @param {string} status - Device status
 */
function updateDeviceStatus(deviceId, status) {
    // Update in list view
    const listItems = document.querySelectorAll(`.device-item[data-device-id="${deviceId}"]`);
    listItems.forEach(item => {
        const statusCircle = item.querySelector('.status-circle');
        if (statusCircle) {
            statusCircle.className = `status-circle ${status === 'online' ? 'status-active' : 'status-inactive'}`;
        }
    });
    
    // Update in grid view
    const gridItems = document.querySelectorAll(`.device-card[data-device-id="${deviceId}"]`);
    gridItems.forEach(item => {
        const statusCircle = item.querySelector('.status-circle');
        if (statusCircle) {
            statusCircle.className = `status-circle ${status === 'online' ? 'status-active' : 'status-inactive'}`;
        }
    });
    
    // Update in tables
    const tableRows = document.querySelectorAll(`tr[data-device-id="${deviceId}"]`);
    tableRows.forEach(row => {
        const statusCell = row.querySelector('.device-status');
        if (statusCell) {
            statusCell.innerHTML = status === 'online' ? 
                '<span class="badge bg-success">Online</span>' : 
                '<span class="badge bg-danger">Offline</span>';
        }
    });
}

/**
 * Show alert notification
 * @param {object} alert - Alert object
 */
function showAlertNotification(alert) {
    if (!alert) return;
    
    const severity = alert.severity || 'warning';
    const deviceName = alert.device_name || 'Unknown device';
    const message = alert.message || 'No message';
    
    let title = 'Alert';
    let options = {
        autohide: false
    };
    
    switch (severity) {
        case 'critical':
            title = 'Critical Alert';
            toast.showError(`${deviceName}: ${message}`, options);
            break;
        case 'high':
            title = 'High Alert';
            toast.showError(`${deviceName}: ${message}`, options);
            break;
        case 'medium':
            title = 'Medium Alert';
            toast.showWarning(`${deviceName}: ${message}`, options);
            break;
        case 'low':
            title = 'Low Alert';
            toast.showWarning(`${deviceName}: ${message}`, options);
            break;
        case 'info':
            title = 'Information';
            toast.showInfo(`${deviceName}: ${message}`, options);
            break;
        default:
            toast.showWarning(`${deviceName}: ${message}`, options);
    }
    
    // Show browser notification if supported and permission granted
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: `${deviceName}: ${message}`,
                icon: '/static/img/logo.png'
            });
            
            notification.onclick = function() {
                window.focus();
                if (alert.device_id) {
                    window.location.href = `/monitoring?device=${alert.device_id}&alerts=true`;
                }
            };
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
}

/**
 * Request device update from server
 * @param {number} deviceId - Device ID
 */
function requestDeviceUpdate(deviceId) {
    if (!socket || !socket.connected) {
        console.warn('WebSocket not connected, cannot request device update');
        return;
    }
    
    socket.emit('request_update', { device_id: deviceId });
}

/**
 * Show information message
 */
function showInfo(message) {
    if (typeof toast !== 'undefined' && typeof toast.showInfo === 'function') {
        toast.showInfo(message);
    }
}

/**
 * Show warning message
 */
function showWarning(message) {
    if (typeof toast !== 'undefined' && typeof toast.showWarning === 'function') {
        toast.showWarning(message);
    }
}

/**
 * Show error message
 */
function showError(message) {
    if (typeof toast !== 'undefined' && typeof toast.showError === 'function') {
        toast.showError(message);
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    if (typeof toast !== 'undefined' && typeof toast.showSuccess === 'function') {
        toast.showSuccess(message);
    }
}

// Initialize WebSocket connection when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Request notification permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        document.getElementById('notification-permission-button')?.addEventListener('click', function() {
            Notification.requestPermission();
        });
    }
    
    // Setup WebSocket
    setupWebSocket();
});