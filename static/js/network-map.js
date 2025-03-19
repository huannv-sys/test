/**
 * Network Topology Map
 * Implements a dynamic, interactive network topology visualization using D3.js
 */

// Main visualization variables
let svg = null;
let simulation = null;
let g = null;
let zoomHandler = null;
let tooltip = null;
let width = 0;
let height = 0;

// Network data
let nodes = [];
let links = [];
let nodeMap = new Map();
let selectedNode = null;

// Rendering constants
const COLORS = {
    router: '#0dcaf0',
    switch: '#20c997',
    accessPoint: '#6f42c1',
    client: '#adb5bd',
    server: '#fd7e14',
    unknown: '#adb5bd',
    link: '#495057',
    highlight: '#ffc107',
    selected: '#dc3545',
    background: '#212529'
};

const NODE_SIZES = {
    router: 20,
    switch: 18,
    accessPoint: 16,
    client: 8,
    server: 14,
    unknown: 10
};

/**
 * Initialize the network map
 */
function initNetworkMap() {
    console.log('Initializing network map...');
    
    // Set dimensions based on container
    const container = document.getElementById('network-map-container');
    width = container.clientWidth;
    height = container.clientHeight || 600;
    
    // Create SVG container
    svg = d3.select('#network-map')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto;');
    
    // Create zoom behavior
    zoomHandler = d3.zoom()
        .scaleExtent([0.25, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoomHandler);
    
    // Create a group for all network elements
    g = svg.append('g');
    
    // Create tooltip
    tooltip = d3.select('body').append('div')
        .attr('class', 'map-tooltip')
        .style('opacity', 0);
    
    // Create the force simulation
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeSize(d) * 1.5))
        .force('x', d3.forceX(width / 2).strength(0.01))
        .force('y', d3.forceY(height / 2).strength(0.01));
    
    // Create legend
    createLegend();
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Add event listeners
    document.getElementById('refresh-map').addEventListener('click', refreshNetworkMap);
    document.getElementById('reset-zoom').addEventListener('click', resetZoom);
    document.getElementById('fit-graph').addEventListener('click', fitGraph);
    
    // Load initial data
    loadNetworkData();
}

/**
 * Handle window resize events
 */
function handleResize() {
    const container = document.getElementById('network-map-container');
    width = container.clientWidth;
    height = container.clientHeight || 600;
    
    svg.attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);
    
    simulation.force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', d3.forceX(width / 2).strength(0.01))
        .force('y', d3.forceY(height / 2).strength(0.01))
        .alpha(0.3)
        .restart();
}

/**
 * Create a legend for the network map
 */
function createLegend() {
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(20, 20)');
    
    const legendData = [
        { type: 'router', label: 'Router' },
        { type: 'switch', label: 'Switch' },
        { type: 'accessPoint', label: 'Access Point' },
        { type: 'server', label: 'Server' },
        { type: 'client', label: 'Client' }
    ];
    
    const legendItems = legend.selectAll('.legend-item')
        .data(legendData)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 25})`);
    
    legendItems.append('circle')
        .attr('r', 6)
        .attr('fill', d => COLORS[d.type]);
    
    legendItems.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .attr('class', 'legend-text')
        .text(d => d.label);
    
    // Add a white background for the legend
    const legendBBox = legend.node().getBBox();
    legend.insert('rect', ':first-child')
        .attr('x', -10)
        .attr('y', -10)
        .attr('width', legendBBox.width + 20)
        .attr('height', legendBBox.height + 20)
        .attr('fill', 'rgba(33, 37, 41, 0.8)')
        .attr('rx', 5);
}

/**
 * Load network map data from API
 */
async function loadNetworkData() {
    showLoading();
    
    try {
        const apiClient = new ApiClient();
        const response = await apiClient.getNetworkMap();
        
        if (!response.success) {
            throw new Error(response.message || 'Failed to load network data');
        }
        
        updateNetworkMapData(response);
        renderNetworkMap();
    } catch (error) {
        console.error('Error loading network data:', error);
        showError('Error loading network data: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Refresh network map data
 */
function refreshNetworkMap() {
    loadNetworkData();
}

/**
 * Reset zoom to default level
 */
function resetZoom() {
    svg.transition().duration(750).call(
        zoomHandler.transform,
        d3.zoomIdentity,
        d3.zoomTransform(svg.node()).invert([width / 2, height / 2])
    );
}

/**
 * Fit the graph to the view
 */
function fitGraph() {
    if (nodes.length === 0) return;
    
    // Get the bounds of all nodes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
        if (node.x < minX) minX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.x > maxX) maxX = node.x;
        if (node.y > maxY) maxY = node.y;
    });
    
    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    const x = (minX + maxX) / 2;
    const y = (minY + maxY) / 2;
    
    const scale = Math.min(0.9 / Math.max(dx / width, dy / height), 2);
    
    svg.transition().duration(750).call(
        zoomHandler.transform,
        d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-x, -y)
    );
}

/**
 * Update network map data
 * @param {object} data - Network map data
 */
function updateNetworkMapData(data) {
    // Clear existing node map
    nodeMap.clear();
    
    // Process nodes
    nodes = data.nodes.map(node => {
        // Set appropriate node type if not specified
        if (!node.type) {
            if (node.device_type === 'router' || node.model?.toLowerCase().includes('router')) {
                node.type = 'router';
            } else if (node.device_type === 'switch' || node.model?.toLowerCase().includes('switch')) {
                node.type = 'switch';
            } else if (node.device_type === 'accessPoint' || node.model?.toLowerCase().includes('cap') || node.model?.toLowerCase().includes('access point')) {
                node.type = 'accessPoint';
            } else if (node.device_type === 'server' || node.model?.toLowerCase().includes('server')) {
                node.type = 'server';
            } else if (node.device_type === 'client' || node.model?.toLowerCase().includes('client')) {
                node.type = 'client';
            } else {
                node.type = 'unknown';
            }
        }
        
        // If no position, keep previous position if exists or set to center
        const existingNode = nodeMap.get(node.id);
        if (existingNode) {
            if (!node.x) node.x = existingNode.x;
            if (!node.y) node.y = existingNode.y;
        } else {
            if (!node.x) node.x = width / 2 + Math.random() * 100 - 50;
            if (!node.y) node.y = height / 2 + Math.random() * 100 - 50;
        }
        
        // Store in map for lookup
        nodeMap.set(node.id, node);
        
        return node;
    });
    
    // Process links
    links = data.links.map(link => {
        return {
            ...link,
            source: link.source,
            target: link.target,
            value: link.value || 1
        };
    });
}

/**
 * Get color for node based on type
 * @param {string} type - Node type
 * @returns {string} - Color value
 */
function getNodeColor(node) {
    if (node.id === selectedNode) {
        return COLORS.selected;
    }
    
    if (node.status === 'down' || node.status === 'offline') {
        return '#dc3545';  // Error red
    }
    
    return COLORS[node.type] || COLORS.unknown;
}

/**
 * Get node size based on type
 * @param {object} node - Node data
 * @returns {number} - Size value
 */
function getNodeSize(node) {
    return NODE_SIZES[node.type] || NODE_SIZES.unknown;
}

/**
 * Render the network map with current data
 */
function renderNetworkMap() {
    // Clear previous rendering
    g.selectAll('*').remove();
    
    // If no data, show message
    if (nodes.length === 0) {
        g.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('class', 'no-data-message')
            .text('No network data available');
        return;
    }
    
    // Add links
    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke', COLORS.link)
        .attr('stroke-width', d => Math.sqrt(d.value) * 2 || 2)
        .attr('stroke-opacity', 0.6);
    
    // Add nodes
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', getNodeSize)
        .attr('fill', getNodeColor)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // Add node labels
    const label = g.append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(nodes)
        .enter().append('text')
        .attr('class', 'node-label')
        .attr('dx', d => getNodeSize(d) + 5)
        .attr('dy', 4)
        .text(d => d.name || d.label || d.ip_address || d.id.toString())
        .style('font-size', '11px')
        .style('pointer-events', 'none')
        .style('fill', '#adb5bd')
        .style('stroke', 'none');
    
    // Add event handlers
    node.on('mouseover', handleNodeMouseOver)
        .on('mouseout', handleNodeMouseOut)
        .on('click', handleNodeClick);
    
    // Add titles for accessibility
    node.append('title')
        .text(d => d.name || d.label || d.ip_address || d.id.toString());
    
    // Update simulation
    simulation
        .nodes(nodes)
        .on('tick', ticked);
    
    simulation.force('link')
        .links(links);
    
    // Restart simulation
    simulation.alpha(1).restart();
    
    function ticked() {
        // Keep nodes within bounds
        nodes.forEach(d => {
            const r = getNodeSize(d);
            d.x = Math.max(r, Math.min(width - r, d.x));
            d.y = Math.max(r, Math.min(height - r, d.y));
        });
        
        // Update link positions
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        // Update node positions
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        // Update label positions
        label
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    }
}

/**
 * Handle node click event
 * @param {event} event - Click event
 * @param {object} d - Node data
 */
function handleNodeClick(event, d) {
    event.stopPropagation();
    
    // Toggle selection
    if (selectedNode === d.id) {
        selectedNode = null;
    } else {
        selectedNode = d.id;
    }
    
    // Update node colors
    g.selectAll('circle')
        .attr('fill', getNodeColor);
    
    // Show device details
    if (selectedNode) {
        showDeviceDetails(d);
    } else {
        hideDeviceDetails();
    }
}

/**
 * Show device details in the side panel
 * @param {object} device - Device data
 */
function showDeviceDetails(device) {
    const detailsPanel = document.getElementById('device-details-panel');
    const detailsContent = document.getElementById('device-details-content');
    
    detailsContent.innerHTML = '';
    
    // Device name/title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'device-details-title';
    titleDiv.innerHTML = `
        <h5>${device.name || device.label || 'Device Details'}</h5>
        <span class="badge ${device.status === 'online' ? 'bg-success' : 'bg-danger'}">
            ${device.status || 'Unknown'}
        </span>
    `;
    detailsContent.appendChild(titleDiv);
    
    // Basic device information
    const infoDiv = document.createElement('div');
    infoDiv.className = 'device-info';
    infoDiv.innerHTML = `
        <div class="info-row">
            <span class="info-label">IP Address:</span>
            <span class="info-value">${device.ip_address || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">${capitalize(device.type || 'Unknown')}</span>
        </div>
        ${device.model ? `
        <div class="info-row">
            <span class="info-label">Model:</span>
            <span class="info-value">${device.model}</span>
        </div>` : ''}
        ${device.mac_address ? `
        <div class="info-row">
            <span class="info-label">MAC Address:</span>
            <span class="info-value">${device.mac_address}</span>
        </div>` : ''}
    `;
    detailsContent.appendChild(infoDiv);
    
    // If device has metrics, show them
    if (device.metrics) {
        const metricsDiv = document.createElement('div');
        metricsDiv.className = 'device-metrics';
        metricsDiv.innerHTML = `
            <h6 class="details-section-title">Metrics</h6>
            ${device.metrics.cpu ? `
            <div class="metric-row">
                <span class="metric-label">CPU Usage:</span>
                <div class="progress">
                    <div class="progress-bar ${device.metrics.cpu > 80 ? 'bg-danger' : device.metrics.cpu > 60 ? 'bg-warning' : 'bg-info'}" 
                         role="progressbar" style="width: ${device.metrics.cpu}%">
                        ${device.metrics.cpu}%
                    </div>
                </div>
            </div>` : ''}
            ${device.metrics.memory ? `
            <div class="metric-row">
                <span class="metric-label">Memory Usage:</span>
                <div class="progress">
                    <div class="progress-bar ${device.metrics.memory > 80 ? 'bg-danger' : device.metrics.memory > 60 ? 'bg-warning' : 'bg-info'}" 
                         role="progressbar" style="width: ${device.metrics.memory}%">
                        ${device.metrics.memory}%
                    </div>
                </div>
            </div>` : ''}
        `;
        detailsContent.appendChild(metricsDiv);
    }
    
    // If device has interfaces, show them
    if (device.interfaces && device.interfaces.length > 0) {
        const interfacesDiv = document.createElement('div');
        interfacesDiv.className = 'device-interfaces';
        interfacesDiv.innerHTML = `<h6 class="details-section-title">Interfaces</h6>`;
        
        const interfacesList = document.createElement('ul');
        interfacesList.className = 'interfaces-list';
        
        device.interfaces.forEach(iface => {
            const li = document.createElement('li');
            li.className = 'interface-item';
            const statusClass = iface.status === 'up' ? 'status-active' : 'status-inactive';
            li.innerHTML = `
                <span class="status-circle ${statusClass}"></span>
                <span class="interface-name">${iface.name}</span>
                ${iface.traffic ? `<span class="interface-traffic">${formatTraffic(iface.traffic)}</span>` : ''}
            `;
            interfacesList.appendChild(li);
        });
        
        interfacesDiv.appendChild(interfacesList);
        detailsContent.appendChild(interfacesDiv);
    }
    
    // Links to other actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'device-actions mt-3';
    
    // Only show 'View Details' button if device has an ID and is a managed device
    if (device.device_id) {
        actionsDiv.innerHTML = `
            <a href="/monitoring?device=${device.device_id}" class="btn btn-sm btn-outline-info">
                <i class="fas fa-chart-line"></i> View Metrics
            </a>
        `;
        detailsContent.appendChild(actionsDiv);
    }
    
    // Show the panel
    detailsPanel.classList.add('show');
}

/**
 * Hide device details panel
 */
function hideDeviceDetails() {
    const detailsPanel = document.getElementById('device-details-panel');
    detailsPanel.classList.remove('show');
}

/**
 * Handle node mouseover event
 * @param {event} event - Mouseover event
 * @param {object} d - Node data
 */
function handleNodeMouseOver(event, d) {
    // Highlight the node
    d3.select(this)
        .attr('stroke', COLORS.highlight)
        .attr('stroke-width', 2.5);
    
    // Show tooltip
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    
    tooltip.html(`
        <div class="tooltip-content">
            <div class="tooltip-title">${d.name || d.label || 'Device'}</div>
            <div class="tooltip-type">${capitalize(d.type || 'Unknown')}</div>
            ${d.ip_address ? `<div class="tooltip-ip">${d.ip_address}</div>` : ''}
            ${d.status ? `<div class="tooltip-status">Status: ${d.status}</div>` : ''}
        </div>
    `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    
    // Highlight connected links and nodes
    g.selectAll('line')
        .classed('highlighted', link => 
            link.source.id === d.id || link.target.id === d.id);
}

/**
 * Handle node mouseout event
 * @param {event} event - Mouseout event
 * @param {object} d - Node data
 */
function handleNodeMouseOut(event, d) {
    // Reset node style
    d3.select(this)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5);
    
    // Hide tooltip
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    
    // Remove link highlighting
    g.selectAll('line')
        .classed('highlighted', false);
}

/**
 * Create drag behavior for nodes
 */
function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    
    // Keep the position fixed when dropped
    // Uncommenting would make nodes float back
    // d.fx = null;
    // d.fy = null;
}

/**
 * Show loading indicator
 */
function showLoading() {
    document.getElementById('map-loading').style.display = 'block';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    document.getElementById('map-loading').style.display = 'none';
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    toast.showError(message);
}

/**
 * Helper to capitalize first letter of string
 * @param {string} string - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalize(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNetworkMap();
});