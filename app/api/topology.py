from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
from mik.app.database.crud import get_all_devices, get_device_by_id
from mik.app.core.discovery import discover_topology
from mik.app.utils.network import validate_subnet
import traceback

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
topology_bp = Blueprint('topology_bp', __name__, url_prefix='/api/topology')

@topology_bp.route('/map', methods=['GET'])
@jwt_required()
def get_network_map():
    """Get network topology map data"""
    try:
        # Get all devices
        devices = get_all_devices()
        device_list = [device.to_dict() for device in devices]
        
        # Discover topology
        topology_data = discover_topology(devices)
        
        # Format response
        response = {
            "success": True,
            "nodes": [],
            "links": []
        }
        
        # Add nodes (devices)
        for device in device_list:
            # Determine node type based on device model or name
            node_type = "router"  # Default type
            
            # Simple type detection based on common naming patterns
            name_lower = device["name"].lower()
            model_lower = device.get("model", "").lower()
            
            # Check for switches
            if any(term in name_lower for term in ["switch", "sw"]) or \
               any(term in model_lower for term in ["switch", "crs", "css"]):
                node_type = "switch"
            
            # Check for access points
            elif any(term in name_lower for term in ["ap", "access", "wifi", "wlan"]) or \
                 any(term in model_lower for term in ["cap", "wap"]):
                node_type = "accessPoint"
            
            # Check for servers
            elif any(term in name_lower for term in ["server", "srv", "host"]):
                node_type = "server"
            
            # Add metrics data if available
            metrics = {}
            if "cpu_load" in device:
                metrics["cpu"] = device["cpu_load"]
            if "memory_usage" in device:
                metrics["memory"] = device["memory_usage"]
            if "disk_usage" in device:
                metrics["disk"] = device["disk_usage"]
            
            # Create node object
            node = {
                "id": device["id"],
                "device_id": device["id"],  # Duplicate for compatibility
                "name": device["name"],
                "label": device["name"],  # For display
                "ip_address": device["ip_address"],
                "type": node_type,
                "model": device.get("model", "Unknown"),
                "status": device.get("status", "unknown"),
                "group": 1,  # Default group
                "metrics": metrics
            }
            
            # Get interfaces if available
            if "interfaces" in device:
                node["interfaces"] = device["interfaces"]
            
            response["nodes"].append(node)
        
        # Add links from topology data
        for link in topology_data:
            # Determine link type based on interface names or other criteria
            link_type = "ethernet"  # Default link type
            
            # Interface name to help determine link type
            interface_name = link.get("interface_name", "").lower()
            
            # Check for VPN interfaces
            if any(term in interface_name for term in ["vpn", "ppp", "ipsec", "tunnel"]):
                link_type = "vpn"
            
            # Check for wireless interfaces
            elif any(term in interface_name for term in ["wlan", "wifi", "wireless"]):
                link_type = "wireless"
            
            # Check for WAN interfaces
            elif any(term in interface_name for term in ["wan", "internet", "ext"]):
                link_type = "wan"
            
            response["links"].append({
                "source": link["source_id"],
                "target": link["target_id"],
                "value": link.get("bandwidth", 1),  # Link thickness based on bandwidth
                "type": link_type,
                "interface_name": link.get("interface_name", ""),
                "source_interface": link.get("source_interface", ""),
                "target_interface": link.get("target_interface", "")
            })
        
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Error generating network map: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"success": False, "message": f"Error generating network map: {str(e)}"}), 500

@topology_bp.route('/neighbors/<int:device_id>', methods=['GET'])
@jwt_required()
def get_device_neighbors(device_id):
    """Get neighbors for a specific device"""
    try:
        # Get device
        device = get_device_by_id(device_id)
        if not device:
            return jsonify({"error": "Device not found"}), 404
        
        # Get all devices
        all_devices = get_all_devices()
        
        # Discover topology focusing on this device
        topology_data = discover_topology([device], all_devices)
        
        # Format response to include device details
        neighbors = []
        for link in topology_data:
            # If this device is the source
            if link["source_id"] == device_id:
                target_device = get_device_by_id(link["target_id"])
                if target_device:
                    neighbors.append({
                        "device_id": target_device.id,
                        "name": target_device.name,
                        "ip_address": target_device.ip_address,
                        "interface": link.get("source_interface", ""),
                        "remote_interface": link.get("target_interface", "")
                    })
            # If this device is the target
            elif link["target_id"] == device_id:
                source_device = get_device_by_id(link["source_id"])
                if source_device:
                    neighbors.append({
                        "device_id": source_device.id,
                        "name": source_device.name,
                        "ip_address": source_device.ip_address,
                        "interface": link.get("target_interface", ""),
                        "remote_interface": link.get("source_interface", "")
                    })
        
        return jsonify(neighbors)
    
    except Exception as e:
        logger.error(f"Error getting device neighbors: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"error": f"Error getting device neighbors: {str(e)}"}), 500
