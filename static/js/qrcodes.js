/**
 * QR Code integration for MikroTik Monitor
 * Handles generating and displaying QR codes for devices
 */

// Initialize API client if not already initialized
const apiClient = window.apiClient || new ApiClient();

/**
 * Generate QR code for a device
 * @param {number} deviceId - Device ID
 * @param {boolean} includeMetrics - Whether to include metrics data
 * @returns {Promise<object>} - Promise with QR code data
 */
async function generateDeviceQRCode(deviceId, includeMetrics = true) {
    try {
        const response = await apiClient.request(
            `/api/qrcode/device/${deviceId}?include_metrics=${includeMetrics}`, 
            'GET'
        );
        return response;
    } catch (error) {
        console.error('Error generating QR code:', error);
        showError('Error generating QR code');
        throw error;
    }
}

/**
 * Generate quick status QR code for a device
 * @param {number} deviceId - Device ID
 * @returns {Promise<object>} - Promise with QR code data
 */
async function generateQuickStatusQRCode(deviceId) {
    try {
        const response = await apiClient.request(
            `/api/qrcode/quick-status/${deviceId}`, 
            'GET'
        );
        return response;
    } catch (error) {
        console.error('Error generating quick status QR code:', error);
        showError('Error generating quick status QR code');
        throw error;
    }
}

/**
 * Generate batch QR codes for multiple devices
 * @param {array} deviceIds - Array of device IDs
 * @param {boolean} includeMetrics - Whether to include metrics data
 * @returns {Promise<object>} - Promise with QR codes data
 */
async function generateBatchQRCodes(deviceIds, includeMetrics = false) {
    try {
        const response = await apiClient.request(
            '/api/qrcode/batch', 
            'POST',
            {
                device_ids: deviceIds,
                include_metrics: includeMetrics
            }
        );
        return response;
    } catch (error) {
        console.error('Error generating batch QR codes:', error);
        showError('Error generating batch QR codes');
        throw error;
    }
}

/**
 * Display QR code in a modal dialog
 * @param {string} qrcodeBase64 - Base64 encoded QR code image
 * @param {string} title - Modal title
 * @param {string} deviceName - Device name
 */
function displayQRCodeModal(qrcodeBase64, title, deviceName) {
    // Create or get the QR code modal
    let qrModal = document.getElementById('qrCodeModal');
    
    if (!qrModal) {
        // Create the modal if it doesn't exist
        const modalHtml = `
            <div class="modal fade" id="qrCodeModal" tabindex="-1" aria-labelledby="qrCodeModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="qrCodeModalLabel">Device QR Code</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center">
                            <div id="qrCodeImage"></div>
                            <p id="qrCodeDeviceName" class="mt-2"></p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" id="downloadQrCode">Download</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        qrModal = document.getElementById('qrCodeModal');
        
        // Add event listener for download button
        document.getElementById('downloadQrCode').addEventListener('click', downloadQRCode);
    }
    
    // Update modal content
    document.getElementById('qrCodeModalLabel').textContent = title || 'Device QR Code';
    document.getElementById('qrCodeDeviceName').textContent = deviceName || '';
    
    // Set the QR code image
    const qrCodeImage = document.getElementById('qrCodeImage');
    qrCodeImage.innerHTML = `<img src="data:image/png;base64,${qrcodeBase64}" class="img-fluid" alt="QR Code">`;
    
    // Set data attribute for download
    qrCodeImage.setAttribute('data-qrcode', qrcodeBase64);
    qrCodeImage.setAttribute('data-filename', `qrcode_${deviceName.replace(/\s+/g, '_').toLowerCase()}.png`);
    
    // Show the modal
    const modal = new bootstrap.Modal(qrModal);
    modal.show();
}

/**
 * Download the QR code as PNG
 */
function downloadQRCode() {
    const qrCodeImage = document.getElementById('qrCodeImage');
    const qrcodeBase64 = qrCodeImage.getAttribute('data-qrcode');
    const filename = qrCodeImage.getAttribute('data-filename');
    
    if (!qrcodeBase64) return;
    
    // Create link and trigger download
    const downloadLink = document.createElement('a');
    downloadLink.href = `data:image/png;base64,${qrcodeBase64}`;
    downloadLink.download = filename || 'qrcode.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

/**
 * Add QR code button to device cards or list items
 * @param {Array} containers - DOM elements to add buttons to
 * @param {Function} getDeviceId - Function to extract device ID from container
 * @param {Function} getDeviceName - Function to extract device name from container
 */
function addQRCodeButtons(containers, getDeviceId, getDeviceName) {
    containers.forEach(container => {
        // Check if button already exists
        if (container.querySelector('.qr-code-btn')) return;
        
        const deviceId = getDeviceId(container);
        const deviceName = getDeviceName(container);
        
        if (!deviceId) return;
        
        // Create button
        const qrButton = document.createElement('button');
        qrButton.className = 'btn btn-sm btn-outline-info qr-code-btn';
        qrButton.innerHTML = '<i class="bi bi-qr-code"></i>';
        qrButton.title = 'Generate QR Code';
        
        // Add click event
        qrButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // Show loading
                qrButton.disabled = true;
                qrButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
                
                // Generate QR code
                const response = await generateDeviceQRCode(deviceId, true);
                
                // Display QR code
                displayQRCodeModal(
                    response.qrcode_base64,
                    'Device QR Code',
                    response.device_name
                );
            } catch (error) {
                console.error('Error handling QR code button click:', error);
            } finally {
                // Reset button
                qrButton.disabled = false;
                qrButton.innerHTML = '<i class="bi bi-qr-code"></i>';
            }
        });
        
        // Add button to container
        const buttonContainer = container.querySelector('.card-actions') || 
                                container.querySelector('.device-actions') || 
                                container;
        buttonContainer.appendChild(qrButton);
    });
}

/**
 * Initialize QR code functionality
 */
function initializeQRCodes() {
    // Add global click handler for QR code buttons with data attributes
    document.addEventListener('click', async (e) => {
        const qrButton = e.target.closest('[data-qrcode-device-id]');
        if (!qrButton) return;
        
        e.preventDefault();
        
        const deviceId = qrButton.getAttribute('data-qrcode-device-id');
        const deviceName = qrButton.getAttribute('data-qrcode-device-name') || 'Device';
        const quick = qrButton.getAttribute('data-qrcode-quick') === 'true';
        
        if (!deviceId) return;
        
        try {
            // Show loading
            const originalContent = qrButton.innerHTML;
            qrButton.disabled = true;
            qrButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
            
            // Generate QR code
            let response;
            if (quick) {
                response = await generateQuickStatusQRCode(deviceId);
            } else {
                response = await generateDeviceQRCode(deviceId, true);
            }
            
            // Display QR code
            displayQRCodeModal(
                response.qrcode_base64,
                quick ? 'Quick Access QR Code' : 'Device QR Code',
                response.device_name
            );
        } catch (error) {
            console.error('Error handling QR code button click:', error);
        } finally {
            // Reset button
            qrButton.disabled = false;
            qrButton.innerHTML = originalContent;
        }
    });
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', initializeQRCodes);

// Export functions for use in other modules
window.qrCodeUtils = {
    generateDeviceQRCode,
    generateQuickStatusQRCode,
    generateBatchQRCodes,
    displayQRCodeModal,
    addQRCodeButtons
};