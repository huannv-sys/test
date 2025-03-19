/**
 * 3D Network Map Visualization
 * Provides interactive 3D visualization of network topology
 */

// Global variables
let nodes = [];
let links = [];
let nodeObjects = new Map();
let linkObjects = new Map();
let selectedNode = null;
let tooltip = null;
let labels = [];
let toaster = null;

// Three.js specific elements
let nodeMaterials = {};
let linkMaterial = null;
let selectionRing = null;

// Configuration
const NODE_SIZE = {
    router: 5,
    switch: 4,
    wireless: 3.5,
    client: 2.5,
    default: 3
};

const NODE_COLOR = {
    router: 0x4caf50,    // Green
    switch: 0x2196f3,    // Blue
    wireless: 0xff9800,  // Orange
    client: 0xe91e63,    // Pink
    default: 0x9c27b0    // Purple
};

const NODE_HIGHLIGHT_COLOR = 0xffd700; // Gold
const LINK_COLOR = 0xaaaaaa;
const LINK_HIGHLIGHT_COLOR = 0xffffff;
const LABEL_SCALE = 0.8;
const LABEL_Y_OFFSET = 7;

/**
 * Initialize the 3D network map visualization
 */
async function initNetworkMap3D() {
    console.log("Initializing 3D network map...");
    
    // Create tooltip if it doesn't exist
    if (!tooltip) {
        createTooltip();
    }
    
    // Initialize Three.js core components
    init3DNetworkMap();
    
    // Setup materials
    setupMaterials();
    
    // Add click event listeners
    setupEventListeners();
    
    // Load data
    await loadNetworkData();
    
    // Hide loading indicator
    showLoading(false);
    
    console.log("3D network map initialized");
}

/**
 * Create tooltip element
 */
function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.className = 'map-3d-tooltip';
    tooltip.innerHTML = `
        <div class="map-3d-tooltip-title"></div>
        <div class="map-3d-tooltip-content"></div>
    `;
    document.getElementById('network-container').appendChild(tooltip);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const container = document.getElementById('network-map-3d');
    
    // Mouse move for tooltip
    container.addEventListener('mousemove', onMouseMove);
    
    // Mouse click for selection
    container.addEventListener('click', onMouseClick);
    
    // View toggle buttons
    document.getElementById('view-2d-btn').addEventListener('click', function() {
        document.getElementById('view-2d-btn').classList.add('active');
        document.getElementById('view-3d-btn').classList.remove('active');
        document.getElementById('network-map').classList.add('active');
        document.getElementById('network-map-3d').classList.remove('active');
    });
    
    document.getElementById('view-3d-btn').addEventListener('click', function() {
        document.getElementById('view-3d-btn').classList.add('active');
        document.getElementById('view-2d-btn').classList.remove('active');
        document.getElementById('network-map-3d').classList.add('active');
        document.getElementById('network-map').classList.remove('active');
        
        // Need to update renderer when becoming visible
        if (window.onWindowResize) {
            window.onWindowResize();
        }
    });
    
    // Refresh button
    document.getElementById('refresh-map-btn').addEventListener('click', refreshNetworkMap);
}

/**
 * Setup materials for nodes and links
 */
function setupMaterials() {
    // Create materials for different node types
    Object.keys(NODE_COLOR).forEach(type => {
        nodeMaterials[type] = new THREE.MeshLambertMaterial({
            color: NODE_COLOR[type]
        });
    });
    
    // Default material
    nodeMaterials.default = new THREE.MeshLambertMaterial({
        color: NODE_COLOR.default
    });
    
    // Link material
    linkMaterial = new THREE.LineBasicMaterial({
        color: LINK_COLOR,
        opacity: 0.7,
        transparent: true
    });
    
    // Selection ring material
    const selectionMaterial = new THREE.MeshBasicMaterial({
        color: NODE_HIGHLIGHT_COLOR,
        transparent: true,
        opacity: 0.8,
        side: THREE.BackSide
    });
    
    // Create selection ring geometry and mesh
    const selectionGeometry = new THREE.SphereGeometry(1.3, 16, 16);
    selectionRing = new THREE.Mesh(selectionGeometry, selectionMaterial);
    selectionRing.visible = false;
    selectionRing.scale.set(6, 6, 6);
    scene.add(selectionRing);
}

/**
 * Load network data from API
 */
async function loadNetworkData() {
    const mapStatus = document.getElementById('map-status');
    mapStatus.textContent = "Loading network data...";
    showLoading(true);
    
    try {
        // Clear existing objects
        clearNetworkMap();
        
        // Get the API client if available
        const api = window.apiClient || { getNetworkMap: () => Promise.reject(new Error("API client not available")) };
        
        // Try to get network map data from API
        const data = await api.getNetworkMap();
        updateNetworkData(data);
        
        // Process node positions
        processNodePositions();
        
        // Render the network map
        renderNetworkMap();
        
        mapStatus.textContent = `${nodes.length} devices, ${links.length} connections`;
        showLoading(false);
    } catch (error) {
        console.error("Error loading network data:", error);
        showError("Error loading network data: " + error.message);
        
        // Fall back to demo data when API fails
        useDemoData();
        
        showLoading(false);
    }
}

/**
 * Update network data
 * @param {object} data - Network data
 */
function updateNetworkData(data) {
    // Save nodes and links data
    nodes = data.nodes || [];
    links = data.links || [];
    
    // Fix node structure if needed (API returns different structure)
    nodes.forEach(node => {
        // Ensure node has a position object
        if (!node.position) {
            node.position = {
                x: node.x || 0,
                y: node.y || 0,
                z: node.z || 0
            };
        }
        
        // Ensure status property exists
        if (!node.status) {
            node.status = 'unknown';
        }
        
        // Fix type if it's in different format
        if (node.type === 'accessPoint') {
            node.type = 'wireless';
        }
    });
    
    // Process node positions for 3D
    processNodePositions();
}

/**
 * Use demo data when API is not available
 */
function useDemoData() {
    console.log("Using demo data for network visualization");
    const demoData = generateDemoNetworkData();
    updateNetworkData(demoData);
    renderNetworkMap();
    
    const mapStatus = document.getElementById('map-status');
    mapStatus.textContent = `DEMO MODE: ${nodes.length} devices, ${links.length} connections`;
}

/**
 * Process node positions for 3D visualization
 * Distribute nodes in 3D space if position is missing
 */
function processNodePositions() {
    const defaultPositions = {
        router: { y: 0, z: 5 },
        switch: { y: 0, z: 0 },
        wireless: { y: 0, z: -5 },
        client: { y: 0, z: -10 }
    };
    
    // Set default positions for nodes without explicit positions
    nodes.forEach((node, index) => {
        if (!node.position) {
            const typeDefaults = defaultPositions[node.type] || { y: 0, z: 0 };
            // Arrange in a circle if no position specified
            const angle = (index / nodes.length) * Math.PI * 2;
            const radius = 30;
            
            node.position = {
                x: Math.cos(angle) * radius,
                y: typeDefaults.y + Math.sin(angle) * radius * 0.5,
                z: typeDefaults.z
            };
        }
    });
}

/**
 * Render network map with 3D elements
 */
function renderNetworkMap() {
    // Create nodes
    createNodes();
    
    // Create links between nodes
    createLinks();
    
    // Create text labels
    createNodeLabels();
    
    // Position camera to see all nodes
    fitCameraToNetwork();
}

/**
 * Clear all network objects from scene
 */
function clearNetworkMap() {
    // Clear node objects
    nodeObjects.forEach(obj => {
        scene.remove(obj);
    });
    nodeObjects.clear();
    
    // Clear link objects
    linkObjects.forEach(obj => {
        scene.remove(obj);
    });
    linkObjects.clear();
    
    // Clear labels
    labels.forEach(label => {
        scene.remove(label);
    });
    labels = [];
    
    // Reset selection
    selectedNode = null;
    if (selectionRing) {
        selectionRing.visible = false;
    }
}

/**
 * Create 3D nodes
 */
function createNodes() {
    nodes.forEach(node => {
        // Determine node size and color based on type
        const size = NODE_SIZE[node.type] || NODE_SIZE.default;
        const material = nodeMaterials[node.type] || nodeMaterials.default;
        
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(size, 32, 32);
        const mesh = new THREE.Mesh(geometry, material.clone());
        
        // Set position
        mesh.position.set(
            node.position.x || 0,
            node.position.y || 0,
            node.position.z || 0
        );
        
        // Store node data with mesh
        mesh.userData = node;
        
        // Add to scene
        scene.add(mesh);
        nodeObjects.set(node.id, mesh);
    });
}

/**
 * Create 3D links between nodes
 */
function createLinks() {
    links.forEach(link => {
        // Handle potential differences in API structure
        const sourceId = link.source ? (typeof link.source === 'object' ? link.source.id : link.source) : (link.source_id || '');
        const targetId = link.target ? (typeof link.target === 'object' ? link.target.id : link.target) : (link.target_id || '');
        
        const sourceNode = nodeObjects.get(sourceId);
        const targetNode = nodeObjects.get(targetId);
        
        if (sourceNode && targetNode) {
            // Create line geometry
            const points = [
                sourceNode.position.clone(),
                targetNode.position.clone()
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, linkMaterial.clone());
            
            // Store link data with line
            line.userData = {
                ...link,
                source: sourceId,
                target: targetId,
                sourceNode: sourceNode.userData,
                targetNode: targetNode.userData
            };
            
            // Add to scene
            scene.add(line);
            linkObjects.set(`${sourceId}-${targetId}`, line);
        } else {
            console.warn(`Failed to create link: source or target node not found`, { source: sourceId, target: targetId });
        }
    });
}

/**
 * Create 3D text labels for nodes
 */
function createNodeLabels() {
    // Only create labels if font is loaded
    if (!font) {
        console.warn("Font not loaded, skipping labels");
        return;
    }
    
    nodes.forEach(node => {
        const nodeMesh = nodeObjects.get(node.id);
        if (!nodeMesh) return;
        
        // Create text geometry
        const textGeometry = new THREE.TextGeometry(node.name, {
            font: font,
            size: 2,
            height: 0.1,
            curveSegments: 3
        });
        
        // Center text geometry
        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
        textGeometry.translate(-textWidth / 2, 0, 0);
        
        // Create text mesh
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        
        // Position text above node
        textMesh.position.x = nodeMesh.position.x;
        textMesh.position.y = nodeMesh.position.y + LABEL_Y_OFFSET;
        textMesh.position.z = nodeMesh.position.z;
        
        // Scale text
        textMesh.scale.set(LABEL_SCALE, LABEL_SCALE, LABEL_SCALE);
        
        // Add to scene and store
        scene.add(textMesh);
        labels.push(textMesh);
    });
}

/**
 * Fit camera to show all network elements
 */
function fitCameraToNetwork() {
    if (nodes.length === 0) return;
    
    // Calculate bounding box of all nodes
    const box = new THREE.Box3();
    
    nodeObjects.forEach(node => {
        box.expandByPoint(node.position);
    });
    
    // Get center and size of bounding box
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Find max dimension and add margin
    const maxDim = Math.max(size.x, size.y, size.z) * 1.5;
    
    // Move camera to show all nodes
    camera.position.x = center.x;
    camera.position.y = center.y;
    camera.position.z = center.z + maxDim;
    
    // Look at center
    camera.lookAt(center);
    controls.target.copy(center);
    
    // Update controls
    controls.update();
    
    // Force render
    needsUpdate = true;
}

/**
 * Handle mouse move event
 * @param {Event} event - Mouse event
 */
function onMouseMove(event) {
    if (!scene || !camera) return;
    
    // Get container position
    const container = document.getElementById('network-map-3d');
    const rect = container.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    
    // Update raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    
    // Get intersections with node objects
    const intersects = raycaster.intersectObjects(Array.from(nodeObjects.values()));
    
    if (intersects.length > 0) {
        // Mouse is over a node
        const nodeMesh = intersects[0].object;
        const nodeData = nodeMesh.userData;
        
        // Show tooltip
        showTooltip(nodeData, event.clientX, event.clientY);
        
        // Set cursor
        container.style.cursor = 'pointer';
    } else {
        // Hide tooltip
        hideTooltip();
        
        // Reset cursor
        container.style.cursor = 'default';
    }
}

/**
 * Handle mouse click event
 * @param {Event} event - Mouse event
 */
function onMouseClick(event) {
    if (!scene || !camera) return;
    
    // Get container position
    const container = document.getElementById('network-map-3d');
    const rect = container.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    
    // Update raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    
    // Get intersections with node objects
    const intersects = raycaster.intersectObjects(Array.from(nodeObjects.values()));
    
    if (intersects.length > 0) {
        // Click on a node
        const nodeMesh = intersects[0].object;
        selectNode(nodeMesh);
    } else {
        // Click on empty space
        deselectNode();
    }
}

/**
 * Select a node
 * @param {THREE.Mesh} nodeMesh - Node mesh
 */
function selectNode(nodeMesh) {
    // Deselect previous node if any
    deselectNode();
    
    // Store selected node
    selectedNode = nodeMesh;
    
    // Get node data
    const nodeData = nodeMesh.userData;
    
    // Show selection ring
    selectionRing.position.copy(nodeMesh.position);
    selectionRing.visible = true;
    
    // Highlight links connected to this node
    highlightConnectedLinks(nodeData.id);
    
    // Show device details
    showDeviceDetails(nodeData);
    
    // Force render
    needsUpdate = true;
}

/**
 * Deselect current node
 */
function deselectNode() {
    if (!selectedNode) return;
    
    // Hide selection ring
    selectionRing.visible = false;
    
    // Reset link highlights
    resetLinkHighlights();
    
    // Hide device details
    hideDeviceDetails();
    
    // Clear selection
    selectedNode = null;
    
    // Force render
    needsUpdate = true;
}

/**
 * Highlight links connected to a node
 * @param {string} nodeId - Node ID
 */
function highlightConnectedLinks(nodeId) {
    // Reset all links first
    resetLinkHighlights();
    
    // Find and highlight connected links
    linkObjects.forEach((linkObj, key) => {
        const link = linkObj.userData;
        
        if (link.source === nodeId || link.target === nodeId) {
            // Highlight this link
            linkObj.material.color.set(LINK_HIGHLIGHT_COLOR);
            linkObj.material.opacity = 1.0;
        }
    });
}

/**
 * Reset link highlights
 */
function resetLinkHighlights() {
    linkObjects.forEach((linkObj) => {
        linkObj.material.color.set(LINK_COLOR);
        linkObj.material.opacity = 0.7;
    });
}

/**
 * Show device details in side panel
 * @param {object} device - Device data
 */
function showDeviceDetails(device) {
    const detailsPanel = document.getElementById('device-details-panel');
    
    // Set device name
    document.getElementById('details-device-name').textContent = device.name;
    
    // Set device status
    const statusIndicator = document.getElementById('details-device-status');
    statusIndicator.className = 'device-status-indicator';
    statusIndicator.classList.add(`status-${device.status || 'unknown'}`);
    
    // Set device details
    document.getElementById('details-model').textContent = device.model || '-';
    document.getElementById('details-ip').textContent = device.ip || '-';
    document.getElementById('details-location').textContent = device.location || '-';
    document.getElementById('details-uptime').textContent = device.metrics?.uptime || '-';
    document.getElementById('details-version').textContent = device.version || '-';
    
    // Set resource usage
    const cpuValue = device.metrics?.cpu || 0;
    document.getElementById('details-cpu').textContent = `${cpuValue}%`;
    document.getElementById('details-cpu-bar').style.width = `${cpuValue}%`;
    
    const memoryValue = device.metrics?.memory || 0;
    document.getElementById('details-memory').textContent = `${memoryValue}%`;
    document.getElementById('details-memory-bar').style.width = `${memoryValue}%`;
    
    // Set connected devices count
    const connectedCount = device.metrics?.clients || 0;
    document.getElementById('details-connected-count').textContent = `${connectedCount} devices`;
    
    // Set view details link
    const detailsBtn = document.getElementById('details-view-btn');
    detailsBtn.href = `/devices?id=${device.id}`;
    
    // Set monitor link
    const monitorBtn = document.getElementById('details-monitor-btn');
    monitorBtn.href = `/monitoring?device=${device.id}`;
    
    // Show panel
    detailsPanel.classList.remove('d-none');
}

/**
 * Hide device details side panel
 */
function hideDeviceDetails() {
    const detailsPanel = document.getElementById('device-details-panel');
    detailsPanel.classList.add('d-none');
}

/**
 * Show tooltip for node
 * @param {object} node - Node data
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 */
function showTooltip(node, x, y) {
    if (!tooltip) return;
    
    // Set tooltip content
    tooltip.querySelector('.map-3d-tooltip-title').innerHTML = `
        <span class="node-status node-status-${node.status || 'unknown'}"></span>
        ${node.name}
    `;
    
    let content = `
        <div class="map-3d-tooltip-row">
            <span class="map-3d-tooltip-label">Type:</span>
            <span>${capitalize(node.type || 'Unknown')}</span>
        </div>
        <div class="map-3d-tooltip-row">
            <span class="map-3d-tooltip-label">IP:</span>
            <span>${node.ip || 'N/A'}</span>
        </div>
    `;
    
    // Add metrics if available
    if (node.metrics) {
        if (node.metrics.cpu !== undefined) {
            content += `
                <div class="map-3d-tooltip-row">
                    <span class="map-3d-tooltip-label">CPU:</span>
                    <span>${node.metrics.cpu}%</span>
                </div>
            `;
        }
        
        if (node.metrics.memory !== undefined) {
            content += `
                <div class="map-3d-tooltip-row">
                    <span class="map-3d-tooltip-label">Memory:</span>
                    <span>${node.metrics.memory}%</span>
                </div>
            `;
        }
        
        if (node.metrics.traffic !== undefined) {
            content += `
                <div class="map-3d-tooltip-row">
                    <span class="map-3d-tooltip-label">Traffic:</span>
                    <span>${formatTraffic(node.metrics.traffic)}</span>
                </div>
            `;
        }
    }
    
    tooltip.querySelector('.map-3d-tooltip-content').innerHTML = content;
    
    // Position tooltip
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y + 10) + 'px';
    
    // Show tooltip
    tooltip.classList.add('visible');
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('visible');
}

/**
 * Show loading indicator
 * @param {boolean} show - Whether to show or hide loading indicator
 */
function showLoading(show) {
    let loadingElement = document.querySelector('.map-3d-loading');
    
    if (show) {
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.className = 'map-3d-loading';
            loadingElement.innerHTML = `
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>Loading network map...</div>
            `;
            document.getElementById('network-map-3d').appendChild(loadingElement);
        }
        loadingElement.style.display = 'flex';
    } else if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show message in the network map
 * @param {string} message - Message to show
 */
function showMessage(message) {
    let messageElement = document.querySelector('.network-map-message');
    
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.className = 'network-map-message';
        document.getElementById('network-map-3d').appendChild(messageElement);
    }
    
    messageElement.textContent = message;
    messageElement.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

/**
 * Refresh network map data
 */
function refreshNetworkMap() {
    loadNetworkData();
}

/**
 * Show error message
 */
function showError(message) {
    console.error("3D Network Map Error:", message);
    
    // Show message in the network map
    showMessage("Error: " + message);
    
    // If toast notification system is available
    if (typeof window.toasts !== 'undefined') {
        window.toasts.showError(message);
    }
}

/**
 * Helper to capitalize first letter of string
 * @param {string} string - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * Format traffic value to human-readable string
 * @param {number} bitsPerSecond - Traffic in bits per second
 * @returns {string} - Formatted traffic
 */
function formatTraffic(bitsPerSecond) {
    if (typeof window.formatTraffic === 'function') {
        return window.formatTraffic(bitsPerSecond);
    }
    
    if (!bitsPerSecond) return '0 bps';
    
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    const base = 1000;
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(base));
    
    return parseFloat((bitsPerSecond / Math.pow(base, i)).toFixed(2)) + ' ' + units[i];
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Register initialization function
    const view3dBtn = document.getElementById('view-3d-btn');
    if (view3dBtn) {
        view3dBtn.addEventListener('click', function() {
            setTimeout(initNetworkMap3D, 100);
        });
    }
});
