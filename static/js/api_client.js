/**
 * API Client for MikroTik Monitor
 * Class that handles communication with the backend API
 */
class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('access_token');
        this.refreshToken = localStorage.getItem('refresh_token');
    }

    /**
     * Set the authentication token
     * @param {string} token - JWT token
     * @param {string} refreshToken - JWT refresh token (optional)
     */
    setToken(token, refreshToken = null) {
        this.token = token;
        localStorage.setItem('access_token', token);
        
        if (refreshToken) {
            this.refreshToken = refreshToken;
            localStorage.setItem('refresh_token', refreshToken);
        }
    }

    /**
     * Clear the authentication token
     */
    clearToken() {
        this.token = null;
        this.refreshToken = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    /**
     * Make an API request
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {object} data - Request data
     * @returns {Promise} - Promise with API response
     */
    async request(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const options = {
            method,
            headers,
            credentials: 'same-origin'
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            let response = await fetch(url, options);
            
            // Handle token expiration
            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) {
                    // Update Authorization header with new token
                    options.headers['Authorization'] = `Bearer ${this.token}`;
                    // Retry the request
                    response = await fetch(url, options);
                }
            }
            
            if (!response.ok) {
                // Try to get error message from response
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error ${response.status}`);
                } catch (jsonError) {
                    throw new Error(`HTTP error ${response.status}`);
                }
            }
            
            // Check if response is empty or not JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return { success: true, status: response.status };
            }
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }
    
    /**
     * Refresh the access token using refresh token
     * @returns {Promise<boolean>} - Success status
     */
    async refreshAccessToken() {
        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.refreshToken}`
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.setToken(data.access_token, data.refresh_token);
                return true;
            } else {
                this.clearToken();
                window.location.href = '/login?expired=1';
                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            this.clearToken();
            window.location.href = '/login?expired=1';
            return false;
        }
    }

    /**
     * Login user
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Promise} - Promise with login response
     */
    async login(username, password) {
        return this.request('/auth/login', 'POST', { username, password });
    }

    /**
     * Logout user
     * @returns {Promise} - Promise with logout response
     */
    async logout() {
        const response = await this.request('/auth/logout', 'POST');
        this.clearToken();
        return response;
    }

    /**
     * Get all devices
     * @returns {Promise} - Promise with devices
     */
    async getDevices() {
        return this.request('/devices');
    }

    /**
     * Get device by ID
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with device
     */
    async getDevice(deviceId) {
        return this.request(`/devices/${deviceId}`);
    }

    /**
     * Create a new device
     * @param {object} deviceData - Device data
     * @returns {Promise} - Promise with creation response
     */
    async createDevice(deviceData) {
        return this.request('/devices', 'POST', deviceData);
    }

    /**
     * Update a device
     * @param {number} deviceId - Device ID
     * @param {object} deviceData - Device data
     * @returns {Promise} - Promise with update response
     */
    async updateDevice(deviceId, deviceData) {
        return this.request(`/devices/${deviceId}`, 'PUT', deviceData);
    }

    /**
     * Delete a device
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with deletion response
     */
    async deleteDevice(deviceId) {
        return this.request(`/devices/${deviceId}`, 'DELETE');
    }

    /**
     * Get device interfaces
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with interfaces
     */
    async getDeviceInterfaces(deviceId) {
        return this.request(`/devices/${deviceId}/interfaces`);
    }

    /**
     * Get device clients
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with clients
     */
    async getDeviceClients(deviceId) {
        return this.request(`/devices/${deviceId}/clients`);
    }

    /**
     * Refresh device data
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with refresh response
     */
    async refreshDevice(deviceId) {
        return this.request(`/devices/${deviceId}/refresh`, 'POST');
    }

    /**
     * Get device neighbors
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with device neighbors
     */
    async getDeviceNeighbors(deviceId) {
        return this.request(`/topology/device/${deviceId}/neighbors`);
    }

    /**
     * Create a backup of a device
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with backup response
     */
    async backupDevice(deviceId) {
        return this.request(`/config/backup/${deviceId}`, 'POST');
    }

    /**
     * Get device backups
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with backups
     */
    async getDeviceBackups(deviceId) {
        return this.request(`/config/backup/${deviceId}`);
    }

    /**
     * Run a command on a device
     * @param {number} deviceId - Device ID
     * @param {string} command - Command to run
     * @returns {Promise} - Promise with command response
     */
    async runCommand(deviceId, command) {
        return this.request(`/config/command/${deviceId}`, 'POST', { command });
    }

    /**
     * Discover devices on a network
     * @param {string} subnet - Network subnet
     * @returns {Promise} - Promise with discovered devices
     */
    async discoverDevices(subnet) {
        return this.request('/devices/discover', 'POST', { subnet });
    }

    /**
     * Get device metrics
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with device metrics
     */
    async getDeviceMetrics(deviceId) {
        return this.request(`/monitoring/metrics/${deviceId}`);
    }

    /**
     * Get device traffic data
     * @param {number} deviceId - Device ID
     * @param {string} interface - Interface name
     * @param {number} hours - Hours of history
     * @returns {Promise} - Promise with traffic data
     */
    async getDeviceTraffic(deviceId, interface_name = null, hours = 24) {
        let url = `/monitoring/traffic/${deviceId}?hours=${hours}`;
        if (interface_name) {
            url += `&interface=${encodeURIComponent(interface_name)}`;
        }
        return this.request(url);
    }

    /**
     * Get VPN data for a device
     * @param {number} deviceId - Device ID
     * @returns {Promise} - Promise with VPN data
     */
    async getDeviceVpnData(deviceId) {
        return this.request(`/monitoring/vpn/${deviceId}`);
    }

    /**
     * Get dashboard data
     * @returns {Promise} - Promise with dashboard data
     */
    async getDashboardData() {
        return this.request('/monitoring/dashboard');
    }

    /**
     * Get alerts
     * @param {string} status - Alert status filter
     * @param {number} deviceId - Device ID filter
     * @returns {Promise} - Promise with alerts
     */
    async getAlerts(status = null, deviceId = null) {
        let url = '/monitoring/alerts';
        const params = [];
        
        if (status) {
            params.push(`status=${encodeURIComponent(status)}`);
        }
        
        if (deviceId) {
            params.push(`device_id=${deviceId}`);
        }
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        
        return this.request(url);
    }

    /**
     * Acknowledge an alert
     * @param {number} alertId - Alert ID
     * @returns {Promise} - Promise with acknowledgment response
     */
    async acknowledgeAlert(alertId) {
        return this.request(`/monitoring/alerts/${alertId}/acknowledge`, 'POST');
    }

    /**
     * Get alert rules
     * @returns {Promise} - Promise with alert rules
     */
    async getAlertRules() {
        return this.request('/monitoring/alert-rules');
    }

    /**
     * Create an alert rule
     * @param {object} ruleData - Rule data
     * @returns {Promise} - Promise with creation response
     */
    async createAlertRule(ruleData) {
        return this.request('/monitoring/alert-rules', 'POST', ruleData);
    }

    /**
     * Update an alert rule
     * @param {number} ruleId - Rule ID
     * @param {object} ruleData - Rule data
     * @returns {Promise} - Promise with update response
     */
    async updateAlertRule(ruleId, ruleData) {
        return this.request(`/monitoring/alert-rules/${ruleId}`, 'PUT', ruleData);
    }

    /**
     * Delete an alert rule
     * @param {number} ruleId - Rule ID
     * @returns {Promise} - Promise with deletion response
     */
    async deleteAlertRule(ruleId) {
        return this.request(`/monitoring/alert-rules/${ruleId}`, 'DELETE');
    }

    /**
     * Get network map data
     * @returns {Promise} - Promise with network map data
     */
    async getNetworkMap() {
        return this.request('/topology/map');
    }

    /**
     * Get all users
     * @returns {Promise} - Promise with users
     */
    async getUsers() {
        return this.request('/auth/users');
    }

    /**
     * Get user by ID
     * @param {number} userId - User ID
     * @returns {Promise} - Promise with user
     */
    async getUser(userId) {
        return this.request(`/auth/users/${userId}`);
    }

    /**
     * Create a new user
     * @param {object} userData - User data (username, email, password, role)
     * @returns {Promise} - Promise with creation response
     */
    async createUser(userData) {
        return this.request('/auth/users', 'POST', userData);
    }

    /**
     * Update a user
     * @param {number} userId - User ID
     * @param {object} userData - User data (username, email, password (optional), role)
     * @returns {Promise} - Promise with update response
     */
    async updateUser(userId, userData) {
        return this.request(`/auth/users/${userId}`, 'PUT', userData);
    }

    /**
     * Delete a user
     * @param {number} userId - User ID
     * @returns {Promise} - Promise with deletion response
     */
    async deleteUser(userId) {
        return this.request(`/auth/users/${userId}`, 'DELETE');
    }

    /**
     * Get current user profile
     * @returns {Promise} - Promise with current user's profile
     */
    async getCurrentUser() {
        return this.request('/auth/profile');
    }

    /**
     * Get application settings
     * @returns {Promise} - Promise with application settings
     */
    async getSettings() {
        return this.request('/config/settings');
    }

    /**
     * Update application settings
     * @param {object} settingsData - Settings data
     * @returns {Promise} - Promise with update response
     */
    async updateSettings(settingsData) {
        return this.request('/config/settings', 'PUT', settingsData);
    }
}