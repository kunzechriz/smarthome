import device_logic.drei_d_printer as printer
from flask import Blueprint, request, jsonify

printer_backend = Blueprint('printer', __name__)

######## Remove for public use ########
BAMBU_IP = "xxx.xxx.xxx.xxx"
BAMBU_SERIAL = "xxx"
BAMBU_ACCESS_CODE = "xxx"
######## Remove for public use ########

printer_a1 = printer.BambuPrinter(BAMBU_IP, BAMBU_SERIAL, BAMBU_ACCESS_CODE)
def start_printer_service():
    print(f"[Backend] Starte Drucker-Dienst manuell...")
    printer_a1.start()
@printer_backend.route("/api/printer/data")
def get_printer_data():
    return jsonify(printer_a1.data)
#----------------------------------------------------------------------------------------------------------#
@printer_backend.route("/api/printer/disconnect", methods=["POST"])
def printer_disconnect():
    # Wir nutzen die bestehende Instanz chris_a1
    success = printer_a1.disconnect()
    return jsonify({"ok": success})
#----------------------------------------------------------------------------------------------------------#
@printer_backend.route("/api/printer/command", methods=["POST"])
def printer_command():
    cmd = request.json.get("command")
    if cmd == "pause":
        payload = {"print": {"command": "pause", "sequence_id": "0"}}
    elif cmd == "resume":
        payload = {"print": {"command": "resume", "sequence_id": "0"}}
    elif cmd == "stop":
        payload = {"print": {"command": "stop", "sequence_id": "0"}}
    elif cmd == "light_on":
        payload = {"system": {"command": "ledctrl", "led_node": "chamber_light", "led_mode": "on"}}
    elif cmd == "light_off":
        payload = {"system": {"command": "ledctrl", "led_node": "chamber_light", "led_mode": "off"}}
    elif cmd == "speed":
        # level: 1=Silent, 2=Standard, 3=Sport, 4=Ludicrous
        level = request.json.get("param", "2")
        payload = {"print": {"command": "print_speed", "param": str(level), "sequence_id": "0"}}
    else:
        return jsonify({"ok": False, "error": "Unknown command"}), 400
    success = printer_a1.send_command(payload)
    return jsonify({"ok": success})