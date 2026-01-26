import asyncio
from bleak import BleakScanner
import json
import os
from device_logic.ble_manager import BLEManager
from flask import Blueprint, request, jsonify


led_backend = Blueprint('led', __name__)

#----------------------------------------------------------------------------------------------------------#
ble_loop = None
def set_ble_loop(loop_obj):
    global ble_loop
    ble_loop = loop_obj
#----------------------------------------------------------------------------------------------------------#
PERSISTENCE_FILE = 'device_aliases.json'
UUID = "0000fff3-0000-1000-8000-00805f9b34fb"
ble_manager = BLEManager(UUID)

#----------------------------------------------------------------------------------------------------------#
def load_aliases():
    """Lädt persistente Alias-Namen aus der JSON-Datei."""
    if os.path.exists(PERSISTENCE_FILE):
        with open(PERSISTENCE_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                print(f"WARNUNG: {PERSISTENCE_FILE} ist leer oder beschädigt.")
                return {}
    return {}

#----------------------------------------------------------------------------------------------------------#
def save_aliases(aliases):
    """Speichert persistente Alias-Namen in die JSON-Datei."""
    with open(PERSISTENCE_FILE, 'w') as f:
        json.dump(aliases, f, indent=4)


DEVICE_ALIASES = load_aliases()
active_mac = None

#----------------------------------------------------------------------------------------------------------#

def build_cmd(cmd, p1, r, g, b):
    return bytes([0x7E, 0x00, cmd, p1, r, g, b, 0x00, 0xEF])
#----------------------------------------------------------------------------------------------------------#

def send_command(mac, cmd):

    if mac:
        ble_manager.send_to(mac, cmd)
    else:
        print("[App] No active device selected to send command.")

#----------------------------------------------------------------------------------------------------------#
def led_on(mac):
    cmd = build_cmd(0x04, 0x01, 0, 0, 0)
    send_command(mac, cmd)

#----------------------------------------------------------------------------------------------------------#
def led_off(mac):
    cmd = build_cmd(0x04, 0x00, 0, 0, 0)
    send_command(mac, cmd)
#----------------------------------------------------------------------------------------------------------#


def set_color_rgb_custom(mac, r, g, b):
    cmd = build_cmd(0x05, 0x03, r, g, b)
    send_command(mac, cmd)
#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/power", methods=["POST"])
def api_power():
    global active_mac
    if not active_mac:
        return jsonify({"ok": False, "error": "No device connected"}), 400

    state = request.json["state"]
    if state == "on":
        led_on(active_mac)
    else:
        led_off(active_mac)

    return jsonify({"ok": True})
#----------------------------------------------------------------------------------------------------------#

@led_backend.route("/api/color", methods=["POST"])
def api_color():
    global active_mac
    if not active_mac:
        return jsonify({"ok": False, "error": "No device connected"}), 400

    color = request.json["color"]
    if isinstance(color, list) and len(color) == 3:
        r, g, b = color
        set_color_rgb_custom(active_mac, r, g, b)


    return jsonify({"ok": True})

#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/rename", methods=["POST"])
def api_rename():
    data = request.json
    mac = data.get("mac", "").upper()
    new_name = data.get("name", "").strip()

    if not mac or not new_name:
        return jsonify({"ok": False, "error": "MAC oder Name fehlt"}), 400

    global DEVICE_ALIASES

    # 1. Alias in den globalen Speicher aufnehmen
    DEVICE_ALIASES[mac] = new_name

    # 2. Alias persistent speichern
    save_aliases(DEVICE_ALIASES)

    print(f"Gerät {mac} permanent umbenannt zu: {new_name}")
    return jsonify({"ok": True, "name": new_name})

#----------------------------------------------------------------------------------------------------------#

@led_backend.route("/api/devices")
def api_devices():
    async def scan():
        try:
            # Scan mit kurzem Timeout starten
            devices = await BleakScanner.discover(timeout=5.0, adapter="hci0")
        except Exception as e:
            print(f"BleakScanner Error: {e}")
            # Fallback: Leere Liste zurückgeben, statt abzustürzen
            return []

        filtered = []
        managed_devices = ble_manager.devices

        for d in devices:
            # Basis-Daten immer verfügbar
            mac_addr = d.address.upper()
            name = (d.name or "Unknown").upper()

            is_relevant_device = False

            # 1. Alias Check
            if mac_addr in DEVICE_ALIASES:
                is_relevant_device = True

            # 2. Name Check
            elif "ELK-BLEDOM" in name:
                is_relevant_device = True

            # 3. UUID Check
            else:
                service_uuids = []
                # Versuch 1: metadata (neue bleak Versionen)
                if hasattr(d, 'metadata') and isinstance(d.metadata, dict):
                    service_uuids = d.metadata.get('uuids', [])

                # Versuch 2: details (ältere Versionen / backend spezifisch)
                elif hasattr(d, 'details') and isinstance(d.details, dict) and 'props' in d.details:
                    service_uuids = d.details['props'].get('UUIDs', [])

                # Versuch 3: details direkt (manche backends)
                elif hasattr(d, 'details') and hasattr(d.details, 'get'):
                    service_uuids = d.details.get('UUIDs', [])

                # Abgleich
                if UUID.lower() in [str(u).lower() for u in service_uuids]:
                    is_relevant_device = True

            if not is_relevant_device:
                continue

            # Alias holen
            alias = DEVICE_ALIASES.get(mac_addr)

            # Check Status
            is_connected = False
            if mac_addr in managed_devices:
                is_connected = managed_devices[mac_addr].connected

            display_name = alias if alias else d.name or f"Unknown ({d.address})"

            filtered.append({
                "name": display_name,
                "mac": d.address,
                "connected": is_connected
            })


        macs_in_filtered = {d['mac'] for d in filtered}

        for mac, conn_obj in managed_devices.items():
            if mac not in macs_in_filtered:
                alias = DEVICE_ALIASES.get(mac, mac)
                filtered.append({
                    "name": alias,
                    "mac": mac,
                    "connected": conn_obj.connected
                })

        return filtered

    try:
        future = asyncio.run_coroutine_threadsafe(scan(), ble_loop)
        devices = future.result(timeout=10)
        return jsonify(devices)
    except TimeoutError:
        print("ERROR: Scan timed out.")
        # Bei Timeout leere Liste senden, damit Frontend nicht crasht
        return jsonify([])
    except Exception as e:
        print(f"ERROR in api_devices: {e}")
        return jsonify([])
#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/known_devices")
def api_known_devices():

    devices_list = []
    processed_macs = set()

    for mac, alias in DEVICE_ALIASES.items():
        processed_macs.add(mac)

        ble_manager.add_device(mac)

        is_connected = False
        if mac in ble_manager.devices:
            is_connected = ble_manager.devices[mac].connected

        devices_list.append({
            "name": alias,
            "mac": mac,
            "connected": is_connected
        })

    for mac, conn_obj in ble_manager.devices.items():
        if mac not in processed_macs:
            devices_list.append({
                "name": f"Unknown ({mac})",
                "mac": mac,
                "connected": conn_obj.connected
            })

    return jsonify(devices_list)

#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/connect", methods=["POST"])
def api_connect():
    global active_mac
    mac = request.json["mac"].upper()

    ble_manager.add_device(mac)

    is_connected = ble_manager.devices[mac].connected

    active_mac = mac

    alias_name = DEVICE_ALIASES.get(mac, mac)

    return jsonify({"ok": True, "connected": is_connected, "mac": mac, "name": alias_name})


#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/status")
def api_status():

    known_devices = []

    all_macs = set(DEVICE_ALIASES.keys()) | set(ble_manager.devices.keys())

    for mac in all_macs:
        alias = DEVICE_ALIASES.get(mac, f"Device {mac}")

        is_connected = False
        if mac in ble_manager.devices:
            is_connected = ble_manager.devices[mac].connected

        known_devices.append({
            "name": alias,
            "mac": mac,
            "connected": is_connected
        })

    return jsonify(known_devices)

#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/disconnect", methods=["POST"])
def api_disconnect():
    global active_mac
    mac_to_disconnect = active_mac

    if not mac_to_disconnect:
        return jsonify({"ok": False, "msg": "No active device to disconnect"}), 400

    try:
        ble_manager.remove_device(mac_to_disconnect)
    except Exception as e:
        print(f"ERROR: Disconnect failed in BLEManager for {mac_to_disconnect}: {e}")
        pass

    active_mac = None

    return jsonify({"ok": True, "msg": f"Disconnected {mac_to_disconnect}"})

#----------------------------------------------------------------------------------------------------------#
@led_backend.route("/api/disconnect_all", methods=["POST"])
def api_disconnect_all():

    disconnected_macs = list(ble_manager.devices.keys())

    for mac in disconnected_macs:
        ble_manager.remove_device(mac)

    global active_mac
    if active_mac in disconnected_macs:
        active_mac = None

    if active_mac is not None and active_mac in disconnected_macs:
        active_mac = None

    print(f"[BLE Manager] Disconnected all devices: {disconnected_macs}")
    return jsonify({"ok": True, "disconnected_count": len(disconnected_macs)})
