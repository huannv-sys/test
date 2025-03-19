/**
 * Demo data generator for 3D network visualization
 * Creates a sample network topology for testing when no real data is available
 */

/**
 * Generate demo network topology data
 * @returns {object} Network data with nodes and links
 */
function generateDemoNetworkData() {
    console.log("Generating demo network data for 3D visualization");
    
    // Create demo nodes
    const nodes = [
        {
            id: "router1",
            name: "Core Router",
            type: "router",
            status: "online",
            model: "CCR1036-8G-2S+",
            ip: "192.168.1.1",
            metrics: {
                cpu: 15,
                memory: 28,
                uptime: "23d 4h 12m"
            },
            position: { x: 0, y: 0, z: 0 }
        },
        {
            id: "switch1",
            name: "Main Switch",
            type: "switch",
            status: "online",
            model: "CRS326-24G-2S+",
            ip: "192.168.1.2",
            metrics: {
                cpu: 8,
                memory: 22,
                uptime: "45d 7h 32m"
            },
            position: { x: 15, y: 0, z: 0 }
        },
        {
            id: "ap1",
            name: "Office AP",
            type: "wireless",
            status: "online",
            model: "wAP AC",
            ip: "192.168.1.3",
            metrics: {
                cpu: 12,
                memory: 35,
                uptime: "7d 14h 25m"
            },
            position: { x: 25, y: 10, z: 0 }
        },
        {
            id: "switch2",
            name: "Floor 2 Switch",
            type: "switch",
            status: "online",
            model: "CRS125-24G-1S",
            ip: "192.168.1.4",
            metrics: {
                cpu: 5,
                memory: 18,
                uptime: "31d 9h 40m"
            },
            position: { x: 15, y: -15, z: 0 }
        },
        {
            id: "ap2",
            name: "Floor 2 AP",
            type: "wireless",
            status: "online",
            model: "hAP ac²",
            ip: "192.168.1.5",
            metrics: {
                cpu: 22,
                memory: 41,
                uptime: "15d 3h 12m"
            },
            position: { x: 25, y: -20, z: 0 }
        },
        {
            id: "router2",
            name: "Backup Router",
            type: "router",
            status: "online",
            model: "RB3011UiAS",
            ip: "192.168.1.6",
            metrics: {
                cpu: 7,
                memory: 25,
                uptime: "53d 8h 5m"
            },
            position: { x: -15, y: 10, z: 0 }
        },
        {
            id: "gateway",
            name: "Internet Gateway",
            type: "router",
            status: "online",
            model: "RB2011UiAS",
            ip: "192.168.1.254",
            metrics: {
                cpu: 32,
                memory: 45,
                uptime: "18d 22h 30m"
            },
            position: { x: -15, y: -15, z: 0 }
        },
        {
            id: "client1",
            name: "Office PC",
            type: "client",
            status: "online",
            model: "PC",
            ip: "192.168.1.101",
            metrics: {
                uptime: "6h 12m"
            },
            position: { x: 35, y: 15, z: 0 }
        },
        {
            id: "client2",
            name: "Conference Room",
            type: "client",
            status: "online",
            model: "PC",
            ip: "192.168.1.102",
            metrics: {
                uptime: "3h 45m"
            },
            position: { x: 35, y: -25, z: 0 }
        }
    ];
    
    // Create demo links
    const links = [
        { source: "router1", target: "switch1", type: "ethernet", traffic: 45000000 },
        { source: "router1", target: "router2", type: "ethernet", traffic: 15000000 },
        { source: "router1", target: "gateway", type: "ethernet", traffic: 75000000 },
        { source: "switch1", target: "ap1", type: "ethernet", traffic: 22000000 },
        { source: "switch1", target: "switch2", type: "ethernet", traffic: 35000000 },
        { source: "switch2", target: "ap2", type: "ethernet", traffic: 18000000 },
        { source: "ap1", target: "client1", type: "wireless", traffic: 12000000 },
        { source: "ap2", target: "client2", type: "wireless", traffic: 8000000 }
    ];
    
    return {
        nodes: nodes,
        links: links
    };
}

// Make function available globally
window.generateDemoNetworkData = generateDemoNetworkData;
