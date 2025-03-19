/**
 * Settings functionality
 * Handles the settings view and configuration management
 */

/**
 * Initialize settings page
 */
function initializeSettings() {
    console.log('Initializing settings...');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load settings
    loadSettings();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Save general settings button
    document.getElementById('saveGeneralBtn').addEventListener('click', function() {
        saveGeneralSettings();
    });
    
    // Save monitoring settings button
    document.getElementById('saveMonitoringBtn').addEventListener('click', function() {
        saveMonitoringSettings();
    });
    
    // Save email settings button
    document.getElementById('saveEmailBtn').addEventListener('click', function() {
        saveEmailSettings();
    });
    
    // Test email button
    document.getElementById('testEmailBtn').addEventListener('click', function() {
        testEmail();
    });
    
    // Save Telegram settings button
    document.getElementById('saveTelegramBtn').addEventListener('click', function() {
        saveTelegramSettings();
    });
    
    // Test Telegram button
    document.getElementById('testTelegramBtn').addEventListener('click', function() {
        testTelegram();
    });
    
    // Save backup settings button
    document.getElementById('saveBackupBtn').addEventListener('click', function() {
        saveBackupSettings();
    });

    // Tab navigation
    const tabLinks = document.querySelectorAll('.settings-nav .nav-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            tabLinks.forEach(item => item.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.settings-content').forEach(content => {
                content.style.display = 'none';
            });
            
            // Show the target tab content
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).style.display = 'block';
        });
    });
}

/**
 * Load settings from API
 */
async function loadSettings() {
    try {
        document.getElementById('settings-loading').style.display = 'block';
        
        const apiClient = new ApiClient();
        const response = await apiClient.getSettings();
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể tải cài đặt');
        }
        
        updateSettingsForm(response.settings);
        
        document.getElementById('settings-loading').style.display = 'none';
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Không thể tải cài đặt');
        document.getElementById('settings-loading').style.display = 'none';
    }
}

/**
 * Update settings form with data
 */
function updateSettingsForm(settings) {
    // General settings
    if (settings.general) {
        document.getElementById('app_name').value = settings.general.app_name || '';
        document.getElementById('app_description').value = settings.general.app_description || '';
        document.getElementById('admin_email').value = settings.general.admin_email || '';
        document.getElementById('default_language').value = settings.general.default_language || 'vi';
        document.getElementById('enable_public_status').checked = settings.general.enable_public_status || false;
    }
    
    // Monitoring settings
    if (settings.monitoring) {
        document.getElementById('monitoring_interval').value = settings.monitoring.interval || 60;
        document.getElementById('alert_check_interval').value = settings.monitoring.alert_check_interval || 30;
        document.getElementById('data_retention_days').value = settings.monitoring.data_retention_days || 30;
        document.getElementById('enable_auto_discovery').checked = settings.monitoring.enable_auto_discovery || false;
        document.getElementById('auto_discovery_interval').value = settings.monitoring.auto_discovery_interval || 1440;
    }
    
    // Email settings
    if (settings.email) {
        document.getElementById('mail_server').value = settings.email.mail_server || '';
        document.getElementById('mail_port').value = settings.email.mail_port || 587;
        document.getElementById('mail_use_tls').checked = settings.email.mail_use_tls !== false;
        document.getElementById('mail_username').value = settings.email.mail_username || '';
        document.getElementById('mail_password').value = settings.email.mail_password ? '••••••••' : '';
        document.getElementById('mail_from').value = settings.email.mail_from || '';
    }
    
    // Telegram settings
    if (settings.telegram) {
        document.getElementById('telegram_bot_token').value = settings.telegram.bot_token ? '••••••••' : '';
        document.getElementById('telegram_chat_id').value = settings.telegram.chat_id || '';
        document.getElementById('enable_telegram_notifications').checked = settings.telegram.enable_notifications || false;
    }
    
    // Backup settings
    if (settings.backup) {
        document.getElementById('enable_auto_backup').checked = settings.backup.enable_auto_backup || false;
        document.getElementById('backup_interval').value = settings.backup.backup_interval || 1440;
        document.getElementById('backup_retention_count').value = settings.backup.backup_retention_count || 5;
        document.getElementById('backup_path').value = settings.backup.backup_path || './backups';
    }
}

/**
 * Save general settings
 */
async function saveGeneralSettings() {
    try {
        document.getElementById('saveGeneralBtn').disabled = true;
        
        const settingsData = {
            general: {
                app_name: document.getElementById('app_name').value,
                app_description: document.getElementById('app_description').value,
                admin_email: document.getElementById('admin_email').value,
                default_language: document.getElementById('default_language').value,
                enable_public_status: document.getElementById('enable_public_status').checked
            }
        };
        
        // Basic validation
        if (!settingsData.general.app_name) {
            throw new Error('Vui lòng nhập tên ứng dụng');
        }
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateSettings(settingsData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể lưu cài đặt');
        }
        
        showSuccess('Đã lưu cài đặt chung thành công');
    } catch (error) {
        console.error('Error saving general settings:', error);
        showError(error.message || 'Không thể lưu cài đặt');
    } finally {
        document.getElementById('saveGeneralBtn').disabled = false;
    }
}

/**
 * Save monitoring settings
 */
async function saveMonitoringSettings() {
    try {
        document.getElementById('saveMonitoringBtn').disabled = true;
        
        const monitoringInterval = parseInt(document.getElementById('monitoring_interval').value);
        const alertCheckInterval = parseInt(document.getElementById('alert_check_interval').value);
        const dataRetentionDays = parseInt(document.getElementById('data_retention_days').value);
        const autoDiscoveryInterval = parseInt(document.getElementById('auto_discovery_interval').value);
        
        // Basic validation
        if (isNaN(monitoringInterval) || monitoringInterval < 10) {
            throw new Error('Chu kỳ giám sát phải lớn hơn 10 giây');
        }
        
        if (isNaN(alertCheckInterval) || alertCheckInterval < 10) {
            throw new Error('Chu kỳ kiểm tra cảnh báo phải lớn hơn 10 giây');
        }
        
        if (isNaN(dataRetentionDays) || dataRetentionDays < 1) {
            throw new Error('Thời gian lưu trữ dữ liệu phải lớn hơn 1 ngày');
        }
        
        if (isNaN(autoDiscoveryInterval) || autoDiscoveryInterval < 60) {
            throw new Error('Chu kỳ tự động dò tìm thiết bị phải lớn hơn 60 phút');
        }
        
        const settingsData = {
            monitoring: {
                interval: monitoringInterval,
                alert_check_interval: alertCheckInterval,
                data_retention_days: dataRetentionDays,
                enable_auto_discovery: document.getElementById('enable_auto_discovery').checked,
                auto_discovery_interval: autoDiscoveryInterval
            }
        };
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateSettings(settingsData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể lưu cài đặt');
        }
        
        showSuccess('Đã lưu cài đặt giám sát thành công');
    } catch (error) {
        console.error('Error saving monitoring settings:', error);
        showError(error.message || 'Không thể lưu cài đặt');
    } finally {
        document.getElementById('saveMonitoringBtn').disabled = false;
    }
}

/**
 * Save email settings
 */
async function saveEmailSettings() {
    try {
        document.getElementById('saveEmailBtn').disabled = true;
        
        const mailPort = parseInt(document.getElementById('mail_port').value);
        
        // Basic validation
        if (!document.getElementById('mail_server').value) {
            throw new Error('Vui lòng nhập địa chỉ mail server');
        }
        
        if (isNaN(mailPort) || mailPort < 1 || mailPort > 65535) {
            throw new Error('Port không hợp lệ');
        }
        
        const settingsData = {
            email: {
                mail_server: document.getElementById('mail_server').value,
                mail_port: mailPort,
                mail_use_tls: document.getElementById('mail_use_tls').checked,
                mail_username: document.getElementById('mail_username').value,
                mail_from: document.getElementById('mail_from').value
            }
        };
        
        // Only include password if it was changed (not still masked)
        const mailPassword = document.getElementById('mail_password').value;
        if (mailPassword && mailPassword !== '••••••••') {
            settingsData.email.mail_password = mailPassword;
        }
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateSettings(settingsData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể lưu cài đặt');
        }
        
        showSuccess('Đã lưu cài đặt email thành công');
    } catch (error) {
        console.error('Error saving email settings:', error);
        showError(error.message || 'Không thể lưu cài đặt');
    } finally {
        document.getElementById('saveEmailBtn').disabled = false;
    }
}

/**
 * Test email configuration
 */
async function testEmail() {
    try {
        document.getElementById('testEmailBtn').disabled = true;
        document.getElementById('testEmailStatus').innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div> Đang gửi email kiểm tra...';
        document.getElementById('testEmailStatus').className = 'test-status';
        
        const apiClient = new ApiClient();
        const response = await apiClient.request('/api/settings/test-email', 'POST');
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể gửi email kiểm tra');
        }
        
        document.getElementById('testEmailStatus').innerHTML = '<i class="fas fa-check text-success"></i> Email kiểm tra đã được gửi thành công';
        document.getElementById('testEmailStatus').className = 'test-status text-success';
    } catch (error) {
        console.error('Error testing email:', error);
        document.getElementById('testEmailStatus').innerHTML = `<i class="fas fa-times text-danger"></i> Lỗi: ${error.message || 'Không thể gửi email kiểm tra'}`;
        document.getElementById('testEmailStatus').className = 'test-status text-danger';
    } finally {
        document.getElementById('testEmailBtn').disabled = false;
    }
}

/**
 * Save Telegram settings
 */
async function saveTelegramSettings() {
    try {
        document.getElementById('saveTelegramBtn').disabled = true;
        
        const settingsData = {
            telegram: {
                chat_id: document.getElementById('telegram_chat_id').value,
                enable_notifications: document.getElementById('enable_telegram_notifications').checked
            }
        };
        
        // Only include token if it was changed (not still masked)
        const botToken = document.getElementById('telegram_bot_token').value;
        if (botToken && botToken !== '••••••••') {
            settingsData.telegram.bot_token = botToken;
        }
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateSettings(settingsData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể lưu cài đặt');
        }
        
        showSuccess('Đã lưu cài đặt Telegram thành công');
    } catch (error) {
        console.error('Error saving Telegram settings:', error);
        showError(error.message || 'Không thể lưu cài đặt');
    } finally {
        document.getElementById('saveTelegramBtn').disabled = false;
    }
}

/**
 * Test Telegram configuration
 */
async function testTelegram() {
    try {
        document.getElementById('testTelegramBtn').disabled = true;
        document.getElementById('testTelegramStatus').innerHTML = '<div class="spinner-border spinner-border-sm text-secondary" role="status"></div> Đang gửi tin nhắn kiểm tra...';
        document.getElementById('testTelegramStatus').className = 'test-status';
        
        const apiClient = new ApiClient();
        const response = await apiClient.request('/api/settings/test-telegram', 'POST');
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể gửi tin nhắn Telegram kiểm tra');
        }
        
        document.getElementById('testTelegramStatus').innerHTML = '<i class="fas fa-check text-success"></i> Tin nhắn kiểm tra đã được gửi thành công';
        document.getElementById('testTelegramStatus').className = 'test-status text-success';
    } catch (error) {
        console.error('Error testing Telegram:', error);
        document.getElementById('testTelegramStatus').innerHTML = `<i class="fas fa-times text-danger"></i> Lỗi: ${error.message || 'Không thể gửi tin nhắn Telegram kiểm tra'}`;
        document.getElementById('testTelegramStatus').className = 'test-status text-danger';
    } finally {
        document.getElementById('testTelegramBtn').disabled = false;
    }
}

/**
 * Save backup settings
 */
async function saveBackupSettings() {
    try {
        document.getElementById('saveBackupBtn').disabled = true;
        
        const backupInterval = parseInt(document.getElementById('backup_interval').value);
        const backupRetentionCount = parseInt(document.getElementById('backup_retention_count').value);
        
        // Basic validation
        if (isNaN(backupInterval) || backupInterval < 60) {
            throw new Error('Chu kỳ backup phải lớn hơn 60 phút');
        }
        
        if (isNaN(backupRetentionCount) || backupRetentionCount < 1) {
            throw new Error('Số lượng backup giữ lại phải lớn hơn 1');
        }
        
        if (!document.getElementById('backup_path').value) {
            throw new Error('Vui lòng nhập đường dẫn backup');
        }
        
        const settingsData = {
            backup: {
                enable_auto_backup: document.getElementById('enable_auto_backup').checked,
                backup_interval: backupInterval,
                backup_retention_count: backupRetentionCount,
                backup_path: document.getElementById('backup_path').value
            }
        };
        
        const apiClient = new ApiClient();
        const response = await apiClient.updateSettings(settingsData);
        
        if (!response.success) {
            throw new Error(response.message || 'Không thể lưu cài đặt');
        }
        
        showSuccess('Đã lưu cài đặt backup thành công');
    } catch (error) {
        console.error('Error saving backup settings:', error);
        showError(error.message || 'Không thể lưu cài đặt');
    } finally {
        document.getElementById('saveBackupBtn').disabled = false;
    }
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
    initializeSettings();
});