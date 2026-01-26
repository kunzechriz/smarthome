from flask import Blueprint, request, jsonify
import requests
from requests.auth import HTTPBasicAuth
import xml.etree.ElementTree as ET

cloud_backend = Blueprint('cloud', __name__)

######## Remove for public use ########
NEXTCLOUD_URL = "xxx/xxx/xxx"
######## Remove for public use ########

# ----------------------------------------------------------------------------------------------------------#

@cloud_backend.route('/api/cloud/files')
def get_nextcloud_files():
    if AUTH is None:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        # WebDAV PROPFIND Anfrage (listet Dateien auf)
        response = requests.request(
            method='PROPFIND',
            url=NEXTCLOUD_URL,
            auth=AUTH,
            headers={'Depth': '1'},
            verify=False
        )

        if response.status_code not in [200, 207]:
            return {"error": "Login fehlgeschlagen"}, 401

        root = ET.fromstring(response.content)
        files = []
        ns = {'d': "DAV:"}

        for response_item in root.findall('.//d:response', ns):
            href = response_item.find('d:href', ns).text

            name = href.split('/')[-2] if href.endswith('/') else href.split('/')[-1]

            if name and name != "admin" and not name.startswith('.'):
                files.append({"name": name, "url": href})

        return {"files": files}
    except Exception as e:
        return {"error": str(e)}, 500

#----------------------------------------------------------------------------------------------------------#
AUTH = None

@cloud_backend.route('/api/cloud/login', methods=['POST'])
def cloud_login():
    global AUTH
    data = request.json
    user = data.get('user')
    pw = data.get('pass')

    # Teste den Login kurz mit einer Anfrage
    test_auth = HTTPBasicAuth(user, pw)
    test_res = requests.request('PROPFIND', NEXTCLOUD_URL, auth=test_auth, headers={'Depth': '0'}, verify=False)

    if test_res.status_code < 400:
        AUTH = test_auth
        return jsonify({"status": "success"}), 200
    else:
        return jsonify({"status": "failed"}), 401
# ----------------------------------------------------------------------------------------------------------#
