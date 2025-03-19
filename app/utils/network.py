"""
Các tiện ích liên quan đến mạng
"""

import re
import socket
import logging
import ipaddress
import subprocess
from concurrent.futures import ThreadPoolExecutor

import netifaces

logger = logging.getLogger('mikrotik_monitor.network')

def validate_ip_address(ip):
    """Validate IP address format"""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

def validate_subnet(subnet):
    """Validate subnet format"""
    try:
        ipaddress.ip_network(subnet, strict=False)
        return True
    except ValueError:
        return False

def check_port_open(ip, port, timeout=2):
    """Check if a port is open on a host"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except socket.error:
        return False

def check_host_reachable(ip, timeout=2):
    """Check if a host is reachable (ping)"""
    # Implementation depends on platform
    import platform
    
    try:
        # Ping command based on platform
        if platform.system().lower() == "windows":
            ping_cmd = ["ping", "-n", "1", "-w", str(int(timeout * 1000)), ip]
        else:
            ping_cmd = ["ping", "-c", "1", "-W", str(int(timeout)), ip]
        
        # Run ping command
        result = subprocess.run(ping_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.returncode == 0
    
    except Exception as e:
        logger.error(f"Error checking if host {ip} is reachable: {e}")
        return False

def get_network_interfaces():
    """Get local network interfaces"""
    interfaces = {}
    
    try:
        iface_names = netifaces.interfaces()
        
        for iface in iface_names:
            # Skip loopback interface
            if iface.startswith('lo') or iface == 'lo0':
                continue
            
            addrs = netifaces.ifaddresses(iface)
            
            # Get IPv4 addresses
            if netifaces.AF_INET in addrs:
                ipv4_info = addrs[netifaces.AF_INET][0]
                ip = ipv4_info.get('addr')
                
                if ip:
                    # Get MAC address
                    mac = None
                    if netifaces.AF_LINK in addrs and 'addr' in addrs[netifaces.AF_LINK][0]:
                        mac = addrs[netifaces.AF_LINK][0]['addr']
                    
                    # Add to interfaces
                    interfaces[iface] = {
                        'ip': ip,
                        'netmask': ipv4_info.get('netmask'),
                        'mac': mac
                    }
        
        return interfaces
    
    except Exception as e:
        logger.error(f"Error getting network interfaces: {e}")
        return {}

def parse_mac_address(mac):
    """Parse and normalize MAC address format"""
    if not mac:
        return None
    
    # Remove common separators and convert to uppercase
    clean_mac = re.sub('[.:-]', '', mac).upper()
    
    # Validate format
    if not re.match(r'^[0-9A-F]{12}$', clean_mac):
        return None
    
    # Format consistently with colons
    formatted_mac = ':'.join(clean_mac[i:i+2] for i in range(0, 12, 2))
    return formatted_mac

def scan_network(subnet, ports=[8728, 8729], workers=10, timeout=1):
    """Scan a network subnet for hosts with MikroTik API ports open
    
    Args:
        subnet (str): Network subnet to scan (e.g., '192.168.1.0/24')
        ports (list): Ports to check (default: MikroTik API ports)
        workers (int): Number of parallel workers
        timeout (int): Connection timeout in seconds
    
    Returns:
        list: List of dictionaries with host information
    """
    # Validate subnet
    if not validate_subnet(subnet):
        logger.error(f"Invalid subnet format: {subnet}")
        return []
    
    # Generate IP addresses from subnet
    try:
        network = ipaddress.ip_network(subnet, strict=False)
        ip_list = list(network.hosts())
    except Exception as e:
        logger.error(f"Error generating IP addresses from subnet {subnet}: {e}")
        return []
    
    # Results container
    results = []
    
    # Function to check a single host
    def check_host(ip):
        ip_str = str(ip)
        
        # Check if host responds to ping
        if check_host_reachable(ip_str, timeout=timeout):
            # Check relevant ports
            open_ports = []
            for port in ports:
                if check_port_open(ip_str, port, timeout=timeout):
                    open_ports.append(port)
            
            # If any port is open, add to results
            if open_ports:
                # Try to get hostname
                try:
                    hostname = socket.getfqdn(ip_str)
                    if hostname == ip_str:  # getfqdn returns IP if no hostname found
                        hostname = None
                except Exception:
                    hostname = None
                
                results.append({
                    'ip': ip_str,
                    'hostname': hostname,
                    'ports': open_ports
                })
                logger.info(f"Found potential MikroTik device at {ip_str} (ports: {open_ports})")
    
    # Scan network with parallel workers
    logger.info(f"Scanning network {subnet} for MikroTik devices...")
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        executor.map(check_host, ip_list)
    
    logger.info(f"Network scan complete. Found {len(results)} potential MikroTik devices")
    return results

def get_network_from_ip(ip, netmask):
    """Get network address from IP and netmask
    
    Args:
        ip (str): IP address
        netmask (str): Subnet mask
    
    Returns:
        str: Network address in CIDR notation or None if invalid
    """
    try:
        if not validate_ip_address(ip) or not netmask:
            return None
        
        # Convert netmask to CIDR prefix
        try:
            netmask_parts = netmask.split('.')
            binary_str = ''
            for octet in netmask_parts:
                binary_str += bin(int(octet))[2:].zfill(8)
            prefix_len = binary_str.count('1')
        except Exception:
            return None
        
        # Create network with CIDR notation
        return str(ipaddress.IPv4Network(f"{ip}/{prefix_len}", strict=False))
    
    except Exception as e:
        logger.error(f"Error getting network from IP {ip} and netmask {netmask}: {e}")
        return None