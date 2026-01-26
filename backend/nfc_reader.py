from device_logic.nfc_reader import NFCReader
from flask import Blueprint
import json
import os
from datetime import datetime
from flask import jsonify

nfc_reader = NFCReader()
# ----------------------------------------------------------------------------------------------------------#

nfc_blueprint = Blueprint('nfc', __name__)

# ----------------------------------------------------------------------------------------------------------#

NFC_DB = 'nfc_log.json'
ADMIN_UID = "BDF18D37"      ######## ÄNDERN FÜR PUBLIC USE ########

# ----------------------------------------------------------------------------------------------------------#

def log_nfc_scan(uid):
    """Speichert jede neue UID mit Zeitstempel in der JSON-Datenbank."""
    logs = []
    if os.path.exists(NFC_DB):
        with open(NFC_DB, 'r') as f:
            try:
                logs = json.load(f)
            except: logs = []

    new_entry = {
        "uid": uid,
        "timestamp": datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    }
    logs.append(new_entry)

    with open(NFC_DB, 'w') as f:
        json.dump(logs, f, indent=4)

# ----------------------------------------------------------------------------------------------------------#
@nfc_blueprint.route('/api/nfc/scan', methods=['GET'])
def api_nfc_scan():
    try:
        # 1. Karte lesen
        uid_raw = nfc_reader.wait_for_card(timeout=5.0)
        uid_hex = uid_raw.hex().upper()

        # 2. In Datenbank loggen
        log_nfc_scan(uid_hex)

        # 3. Admin-Check durchführen
        is_admin = (uid_hex == ADMIN_UID)

        print(f"[NFC] Gelesen: {uid_hex} | Admin: {is_admin}")

        return jsonify({
            "status": "success",
            "uid": uid_hex,
            "is_admin": is_admin
        })

    except TimeoutError:
        return jsonify({
            "status": "timeout",
            "message": "Nix gefunden"
        }), 408
    except Exception as e:
        print(f"NFC Fehler: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500
# ----------------------------------------------------------------------------------------------------------#
@nfc_blueprint.route('/api/nfc/logs')
def get_nfc_logs():
        """Gibt alle gespeicherten Scans zurück."""
        if os.path.exists(NFC_DB):
            with open(NFC_DB, 'r') as f:
                return jsonify(json.load(f))
        return jsonify([])