from flask import Blueprint, jsonify, request
import time
import threading
import platform
import subprocess
from backend.mqtt_sensors import light_storage
from backend.led import led_on, led_off, ble_manager, DEVICE_ALIASES

automation_blueprint = Blueprint('automation', __name__)

# --- KONFIGURATION ---
LUX_THRESHOLD_ON = 1.4  # Lux-Grenze zum Einschalten
LUX_THRESHOLD_OFF = 1.6  # Lux-Grenze zum Ausschalten
PHONE_IP = "xxx.xxx.xxx.xxx"

TARGET_DEVICES = ["Bett", "Sofa"]

# Status-Speicher
automation_states = {
    "zimmer": {"active": False},
    "darkness_trigger": {"active": True},
    "presence_trigger": {"active": True},
    "presence_detected": False,
    "manual_override": False
}


# --- HELPER: PING ---
def is_device_online(ip):
    try:
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '1', '-W', '1', ip]
        return subprocess.call(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0
    except Exception as e:
        print(f"[Automation] Ping Fehler: {e}")
        return False


# --- HELPER: LICHT SCHALTEN ---
def switch_room_lights(turn_on):
    found_devices = 0
    for mac, name in DEVICE_ALIASES.items():
        if any(target.lower() in name.lower() for target in TARGET_DEVICES):
            # Verbindung prüfen/herstellen
            if mac not in ble_manager.devices or not ble_manager.devices[mac].connected:
                ble_manager.add_device(mac)
            try:
                if turn_on:

                    print(f"[Automation] Schalte AN: {name}")
                    led_on(mac)
                else:
                    print(f"[Automation] Schalte AUS: {name}")
                    led_off(mac)
                found_devices += 1
            except Exception as e:
                print(f"[Automation] Fehler an {name}: {e}")

    if found_devices == 0:
        print("[Automation] WARNUNG: Keine Geräte 'Bett' oder 'Sofa' gefunden!")


# --- MAIN LOOP ---
def automation_loop():
    print(f"[Automation] Loop gestartet. Überwache {PHONE_IP}")

    offline_counter = 0

    while True:
        time.sleep(5)  # 5 Sekunden Takt

        is_home_now = is_device_online(PHONE_IP)

        just_arrived = False
        just_left = False

        if is_home_now:
            offline_counter = 0
            if not automation_states["presence_detected"]:
                print("[Automation] 🏠 Handy erkannt! Willkommen zurück.")
                automation_states["presence_detected"] = True
                automation_states["manual_override"] = False
                just_arrived = True
        else:
            offline_counter += 1
            # Erst nach 50 Sek (10x5) wirklich auf "Abwesend" schalten
            if offline_counter > 10 and automation_states["presence_detected"]:
                print("[Automation] 🚶 Handy weg -> Status: Abwesend.")
                automation_states["presence_detected"] = False
                just_left = True


        current_lux = light_storage.get("value", 999)
        lights_are_on = automation_states["zimmer_christian"]["active"]
        is_present = automation_states["presence_detected"]
        is_override = automation_states["manual_override"]

        feature_darkness = automation_states["darkness_trigger"]["active"]
        feature_presence = automation_states["presence_trigger"]["active"]


        if feature_presence and not is_present and lights_are_on:
            print("[Automation] 🛡️ Niemand zuhause -> Licht AUS.")
            automation_states["zimmer_christian"]["active"] = False
            switch_room_lights(False)
            continue


        if feature_darkness:


            should_be_on = (current_lux < LUX_THRESHOLD_ON) and \
                           ((not feature_presence) or (feature_presence and is_present))

            if just_arrived and should_be_on:
                print(f"[Automation] 👋 Welcome Home Trigger -> Licht AN ({current_lux} lux)")
                automation_states["zimmer_christian"]["active"] = True
                switch_room_lights(True)
                continue

            if should_be_on and not lights_are_on:
                if not is_override:
                    print(f"[Automation] 🌙 Es wird dunkel ({current_lux} lux) -> Licht AN")
                    automation_states["zimmer_christian"]["active"] = True
                    switch_room_lights(True)
                else:
                    pass

            elif (current_lux > LUX_THRESHOLD_OFF) and lights_are_on:
                print(f"[Automation] ☀️ Es ist hell ({current_lux} lux) -> Licht AUS")
                automation_states["zimmer_christian"]["active"] = False
                automation_states["manual_override"] = False
                switch_room_lights(False)


# Thread starten
thread = threading.Thread(target=automation_loop, daemon=True)
thread.start()


# --- API ROUTEN ---
@automation_blueprint.route('/api/automation/status')
def get_status():
    return jsonify(automation_states)


@automation_blueprint.route('/api/automation/toggle/<automation_id>', methods=['POST'])
def toggle_automation(automation_id):
    if automation_id not in automation_states:
        return jsonify({"error": "Automation not found"}), 404

    data = request.json
    active = data.get('active', False)
    automation_states[automation_id]["active"] = active

    if automation_id == "zimmer_christian":
        if not active:
            print("[Automation] Manuell deaktiviert -> Lichter aus (Override AKTIV)")
            switch_room_lights(False)
            automation_states["manual_override"] = True
        else:
            print("[Automation] Manuell aktiviert -> Lichter an")
            switch_room_lights(True)
            automation_states["manual_override"] = False

    return jsonify({"status": "success", "state": automation_states[automation_id]})