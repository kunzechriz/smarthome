from flask import Blueprint, request, jsonify

voice_control_backend = Blueprint('voice_control', __name__)

#-----------------------------------------Backend Sprachsteuerung------------------------------------------------------#
API_KEY = "SUPER_KEY_123"
@voice_control_backend.route('/api/voice/command', methods=['POST'])
def voice_command():
    data = request.json
    # 1. Sicherheit prüfen
    if data.get("key") != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    action = data.get("action")
    device = data.get("device")  # z.B. "led_strip"

    # 2. Befehl ausführen
    if device == "led_strip":
        if action == "on":
            # Hier dein MQTT Befehl für AN
            return jsonify({"status": "LED eingeschaltet"})
        elif action == "off":
            # Hier dein MQTT Befehl für AUS
            return jsonify({"status": "LED ausgeschaltet"})
        elif action == "color":
            color = data.get("value")  # [r, g, b]
            # Hier dein MQTT Befehl für FARBE
            return jsonify({"status": f"Farbe auf {color} gesetzt"})

    return jsonify({"error": "Unknown command"}), 400
