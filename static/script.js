let connectedMac = null;
let lastScannedDevices = [];


//----------------------------------------------------------------------------------------------------------//

async function updateLightSensor() {
    const detailValEl = document.getElementById('light-detail-val');
    const detailStatusEl = document.getElementById('light-detail-status');
    const detailRow = document.getElementById('light-sensor-row');
    const widgetValEl = document.getElementById('room-brightness-val');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s Timeout

        const response = await fetch('/api/sensor/light', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Sensor Offline");

        const data = await response.json();


        if (widgetValEl) {
             widgetValEl.innerText = Math.round(data.value) + " lux";
             widgetValEl.style.color = "";
        }

        if (detailValEl) {
             detailValEl.innerText = "Zimmer Helligkeit: " + data.value + " lux";
             detailValEl.style.color = "white";
        }

        if (detailStatusEl) {
             detailStatusEl.innerText = "Online";
             detailStatusEl.style.color = "#2ecc71";
        }

        if (detailRow) detailRow.style.opacity = "1";

    } catch (e) {
        if (widgetValEl) {
            widgetValEl.innerText = "Offline";
        }

        if (detailValEl) {
            detailValEl.innerText = "Zimmer Helligkeit: Offline";
            detailValEl.style.color = "#7f8c8d"; // Grau
        }

        if (detailStatusEl) {
            detailStatusEl.innerText = "Offline";
            detailStatusEl.style.color = "#e74c3c"; // Rot
        }

        if (detailRow) detailRow.style.opacity = "0.6";
    }
}
//----------------------------------------------------------------------------------------------------------//
async function updatePlantSensors() {
    const statusEl = document.getElementById('plant-status-text');

    const moistEl = document.getElementById('plant-moisture-pct');
    const unitEl = document.getElementById('plant-moisture-unit');
    const barEl = document.getElementById('plant-progress-bar');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('/api/sensor/moisture', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Offline");

        const data = await response.json();

        if(moistEl) {
            moistEl.innerText = data.percent;
            moistEl.style.color = "#2ecc71";
        }
        if(unitEl) {
            unitEl.style.display = "inline";
            unitEl.style.color = "white";
        }

        if(barEl) {
            barEl.style.width = data.percent + "%";
            // Farben Logik
            if (data.status === "critical") {
                statusEl.innerText = "Bitte gießen!";
                barEl.style.background = "#e74c3c";
            } else if (data.status === "warning") {
                statusEl.innerText = "Erde wird trocken";
                barEl.style.background = "#f1c40f";
            } else {
                statusEl.innerText = "Alles optimal";
                barEl.style.background = "#2ecc71";
            }
        }

    } catch (e) {
        // OFFLINE
        if(moistEl) {
            moistEl.innerText = "Offline";
            moistEl.style.color = "#7f8c8d";
        }
        if(unitEl) {
            unitEl.style.display = "none";
        }
        if(barEl) {
            barEl.style.width = "0%";
            barEl.style.background = "#7f8c8d";
        }
        if(statusEl) {
            statusEl.innerText = "Sensor Offline";
            statusEl.style.color = "#7f8c8d";
        }
    }

    const tempEl = document.getElementById('plant-temp-val');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch('/api/sensor/temp', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Offline");

        const data = await response.json();

        // ONLINE
        if(tempEl) {
            tempEl.innerText = data.value + " " + data.unit;
            tempEl.style.color = "white";
        }

    } catch (e) {
        // OFFLINE
        if(tempEl) {
            tempEl.innerText = "Offline";
            tempEl.style.color = "#7f8c8d";
        }
    }
}
//----------------------------------------------------------------------------------------------------------//

async function updateBtcChart(interval, btnElement) {
    const containerId = 'btc-chart-container';
    const loadingText = document.getElementById('btc-loading-text');

    if(btnElement) {
        const parent = btnElement.parentElement;
        parent.querySelectorAll('button').forEach(b => b.style.background = 'rgba(255,255,255,0.05)');
        btnElement.style.background = 'rgba(255, 255, 255, 0.3)';
    }

    try {
        if(loadingText) loadingText.style.display = 'block';

        const response = await fetch(`/api/btc/get_chart/${interval}`);

        if(!response.ok) {
            console.error("Server Fehler:", response.status);
            if(loadingText) loadingText.innerText = "Server Fehler";
            return;
        }

        const figure = await response.json();

        if(loadingText) loadingText.style.display = 'none';

        if (!figure.data) {
             if(loadingText) {
                 loadingText.style.display = 'block';
                 loadingText.innerText = "Keine Daten";
             }
             return;
        }

        const config = {
            responsive: true,
            displayModeBar: false
        };

        Plotly.react(containerId, figure.data, figure.layout, config);

    } catch (error) {
        console.error("Chart Fehler:", error);
        if(loadingText) {
            loadingText.style.display = 'block';
            loadingText.innerText = "Fehler";
            loadingText.style.color = "red";
        }
    }
}

//----------------------------------------------------------------------------------------------------------//

window.toggleMapControl = function(type, showControl) {
    const widget = document.getElementById(`map-${type}-widget`);
    const control = document.getElementById(`map-${type}-control`);

    if (showControl) {
        widget.style.display = 'none';
        control.style.display = 'block';
    } else {
        widget.style.display = 'block';
        control.style.display = 'none';
    }
};
//----------------------------------------------------------------------------------------------------------//

let mapColorPickers = {};

window.connectToMapDevice = function(mac, name, elementId) {
    console.log("Map Klick ->", name, elementId);
    connectedMac = mac;

    const title = document.querySelector(`#map_controlPanel_${elementId} h2`);
    if(title) title.innerText = name;

    postJSON("/api/connect", {mac: mac});
    toggleMapLEDView('control', elementId);
};
//----------------------------------------------------------------------------------------------------------//

window.toggleMapLEDView = function(view, elementId) {
    const point = document.getElementById(`led-point-${elementId}`);
    const control = document.getElementById(`map_controlPanel_${elementId}`);

    if (!point || !control) return;

    if (view === 'point') {
        point.style.display = 'block';
        control.style.display = 'none';
    }
    else if (view === 'control') {
        point.style.display = 'none';
        control.style.display = 'block';
        setTimeout(() => initSpecificMapColorWheel(elementId), 50);
    }
};
//----------------------------------------------------------------------------------------------------------//

function initSpecificMapColorWheel(elementId) {
    const containerId = `map_color-wheel_${elementId}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!mapColorPickers[elementId] && typeof iro !== 'undefined') {
        container.innerHTML = "";

        const picker = new iro.ColorPicker("#" + containerId, {
            width: 200, color: "#fff", borderWidth: 2, borderColor: "#333"
        });

        picker.on('color:change', function(color) {
            // An Hardware senden
            if (connectedMac) {
                postJSON("/api/color", {color: [color.rgb.r, color.rgb.g, color.rgb.b]});
            }

            const cStr = `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
            const point = document.getElementById(`led-point-${elementId}`);

            if (point) {
                point.style.setProperty('--local-color', cStr);
            }
            localStorage.setItem(`saved_color_${elementId}`, cStr);
        });

        mapColorPickers[elementId] = picker;
    } else if (mapColorPickers[elementId]) {
        mapColorPickers[elementId].resize(200);
    }
}
//----------------------------------------------------------------------------------------------------------//
window.toggleMapPrinterView = function(view) {
    const point = document.getElementById('printer-point');
    const panel = document.getElementById('map_printer_panel');

    if (!point || !panel) return;

    if (view === 'point') {
        point.style.display = 'flex';
        panel.style.display = 'none';
    }
    else if (view === 'control') {
        point.style.display = 'none';
        panel.style.display = 'block';
    }
};
//----------------------------------------------------------------------------------------------------------//

async function updateSystemHealth() {
    try {
        const response = await fetch('/api/system/health');
        const data = await response.json();

        const tempEl = document.getElementById('sys_temp');

        tempEl.innerHTML = `${data.cpu_temp} <small style="font-size:0.9rem; opacity:0.8">°C</small>`;

        // Farbe ändern
        tempEl.style.color = data.cpu_temp > 70 ? "#e74c3c" : "white";

        document.getElementById('sys_cpu').innerHTML = `${data.cpu_usage} <small style="font-size:0.9rem; opacity:0.8">%</small>`;
        document.getElementById('sys_ram').innerHTML = `${data.ram_usage} <small style="font-size:0.9rem; opacity:0.8">%</small>`;
        document.getElementById('sys_disk').innerHTML = `${data.disk_free} <small style="font-size:0.9rem; opacity:0.8">GB</small>`;

    } catch (err) {
        console.error("System Health Error:", err);
    }
}

// Alle 10 Sekunden aktualisieren
setInterval(updateSystemHealth, 10000);
updateSystemHealth(); // Initialer Aufruf
//----------------------------------------------------------------------------------------------------------//

function hideAll() {
    const views = ['dashboard-view',
        'ledDeviceListPanel',
        'controlPanel',
        'printerControlPanel',
        'cloudOverlay',
        'automationPanel',
        'weatherDetailPanel',
        'nfcControlPanel',
        'roomMapPanel'];

    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}
//----------------------------------------------------------------------------------------------------------//
window.openRoomMap = function() {
    hideAll();
    const panel = document.getElementById('roomMapPanel');
    if (panel) panel.style.display = 'block';
};
//----------------------------------------------------------------------------------------------------------//

function showDashboard() {
    hideAll();
    const dash = document.getElementById('dashboard-view');
    if (dash) {
        dash.style.display = 'grid';
    }
}

//----------------------------------------------------------------------------------------------------------//

async function postJSON(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
        return {ok: false};
    }
}

//----------------------------------------------------------------------------------------------------------//

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

//----------------------------------------------------------------------------------------------------------//

/* --- LED LOGIK --- */
window.openLEDDeviceList = function () {
    hideAll();
    document.getElementById('ledDeviceListPanel').style.display = 'block';

    if (lastScannedDevices.length === 0) {
        scanForNewDevices();
    } else {
        window.renderDeviceList(lastScannedDevices);
    }
};
//----------------------------------------------------------------------------------------------------------//
window.renderDeviceList = function (devices) {
    // 1. Beide Container holen
    const listDash = document.getElementById("led-list-container");
    const listMap = document.getElementById("map_led-list-container");

    // 2. Interne Funktion, die deine exakte Logik kapselt
    const renderTo = (container, isMap) => {
        if (!container) return;
        container.innerHTML = "";

        if (!devices || devices.length === 0) {
            container.innerHTML = "<p style='text-align:center; opacity:0.6;'>Keine Geräte gefunden.</p>";
            return;
        }

        devices.forEach(dev => {
            const btn = document.createElement("div");
            btn.className = "device-item-btn";

            let isConnected = dev.connected === true || dev.connected === "true";
            const activeClass = isConnected ? "active" : "";
            const statusText = isConnected ? "Connected" : "Disconnected";
            const statusColor = isConnected ? "#2ecc71" : "#fd0000";

            const cleanMac = dev.mac.replace(/:/g, '');


            const idPrefix = isMap ? "map_status-" : "status-";
            const statusElementId = `${idPrefix}${cleanMac}`;

            btn.innerHTML = `
                <span style="font-weight:600;">${dev.name}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span id="${statusElementId}" style="font-size: 0.8em; color: ${statusColor}; font-weight: bold; transition: color 0.3s;">${statusText}</span>
                    <div class="device-status-dot ${activeClass}"></div>
                </div>
            `;

            btn.onclick = () => {
                connectToDevice(dev.mac, dev.name);

                if (isMap) {
                    toggleMapLEDView('control');
                } else {

                }
            };

            container.appendChild(btn);
        });
    };

    // 3. Beide Listen rendern
    renderTo(listDash, false); // Dashboard Liste (IDs: status-...)
    renderTo(listMap, true);   // Map Liste (IDs: map_status-...)
};
//----------------------------------------------------------------------------------------------------------//

window.disconnectAllDevices = async function () {
    if (!confirm("Möchtest du wirklich ALLE Geräte trennen?")) return;

    const response = await postJSON("/api/disconnect_all", {});

    if (response.ok) {
        connectedMac = null;
        alert(`Erfolg: ${response.disconnected_count} Geräte getrennt.`);
        scanForNewDevices();
    } else {
        alert(`Fehler: ${response.error}`);
    }
};

//----------------------------------------------------------------------------------------------------------//

async function scanForNewDevices() {
    const list = document.getElementById("led-list-container");

    if (list && lastScannedDevices.length === 0) {
        list.innerHTML = "<p style='text-align:center; opacity:0.6;'>Suche...</p>";
    }

    try {
        const devices = await (await fetch("/api/devices")).json();
        lastScannedDevices = devices;
        window.renderDeviceList(devices);
    } catch (error) {
        if (list && lastScannedDevices.length === 0) {
            list.innerHTML = "<p style='text-align:center; color:#ff6b6b;'>Fehler beim Scannen.</p>";
        }
        console.error(error);
    }
}

//----------------------------------------------------------------------------------------------------------//

window.scanForNewDevices = scanForNewDevices;

async function connectToDevice(mac, name) {
    const response = await postJSON("/api/connect", {mac: mac});

    if (response.ok) {
        connectedMac = mac;
        hideAll();
        document.getElementById('controlPanel').style.display = 'block';

        const nameEl = document.getElementById('currentDeviceName');
        if (nameEl) nameEl.innerText = response.name || name;

        initColorWheel();
    } else {
        alert("Verbindung fehlgeschlagen");
    }
}

//----------------------------------------------------------------------------------------------------------//

async function loadKnownDevices() {
    try {
        const devices = await (await fetch("/api/known_devices")).json();
        lastScannedDevices = devices;
        if (typeof window.renderDeviceList === 'function') window.renderDeviceList(devices);
    } catch (e) {
        console.error("Fehler beim Laden bekannter Geräte:", e);
    }
}

//----------------------------------------------------------------------------------------------------------//

window.finishAndGoBack = function () {
    if (document.getElementById('controlPanel').style.display === 'block') {
        openLEDDeviceList();
    } else {
        showDashboard();
    }
};
//----------------------------------------------------------------------------------------------------------//

window.setPower = function (state) {
    if (connectedMac) postJSON("/api/power", {state: state});
};
//----------------------------------------------------------------------------------------------------------//

/* --- COLOR WHEEL --- */
function initColorWheel() {
    const el = document.getElementById("color-wheel");
    if (!el || el.innerHTML !== "") return;

    if (typeof iro === 'undefined') return;

    const colorPicker = new iro.ColorPicker("#color-wheel", {
        width: 250, color: "#fff", borderWidth: 2, borderColor: "#333"
    });

    const throttledSetColor = throttle(function (r, g, b) {
        if (!connectedMac) return;
        postJSON("/api/color", {color: [r, g, b]});
    }, 100);

    colorPicker.on('color:change', function (color) {
        throttledSetColor(color.rgb.r, color.rgb.g, color.rgb.b);
    });

}
//----------------------------------------------------------------------------------------------------------//

window.showRenameInput = function () {
    const div = document.querySelector('.rename-section');
    if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
};
//----------------------------------------------------------------------------------------------------------//

window.triggerRename = function () {
    const input = document.getElementById("newNameInput");
    const name = input.value;
    if (connectedMac && name) {
        postJSON("/api/rename", {mac: connectedMac, name: name}).then(() => {
            document.getElementById("currentDeviceName").innerText = name;
            document.querySelector('.rename-section').style.display = 'none';
        });
    }
};

//----------------------------------------------------------------------------------------------------------//

window.openPrinterControl = function () {
    hideAll();
    document.getElementById('printerControlPanel').style.display = 'block';
};
window.closePrinterControl = showDashboard;

//----------------------------------------------------------------------------------------------------------//

async function updatePrinterStatus() {
    try {
        const response = await fetch('/api/printer/data');
        if (!response.ok) return;
        const data = await response.json();

        // 1. Daten sicherstellen
        const rawStatus = data.status || "offline";
        const state = rawStatus.toLowerCase();
        const nozzle = Number(data.nozzle_temp || 0).toFixed(1);
        const bed = Number(data.bed_temp || 0).toFixed(1);
        const progress = data.progress || 0;
        const remaining = data.remaining_time || 0;

        // 2. IDs für Dashboard UND Detail Panel
        const ids = {
            'p_status': rawStatus.toUpperCase(),  // Dashboard Widget
            'p_status2': rawStatus.toUpperCase(), // Detail Panel
            'p_nozzle': nozzle, // Dashboard Widget
            'p_nozzle2': nozzle, // Detail Panel
            'p_bed': bed,
            'p_bed2': bed,
            'p_progress': progress,
            'p_progress2': progress + "%",
            'p_remaining': remaining > 0 ? remaining + " Min" : "--",
            'map_p_status_panel': rawStatus.toUpperCase(),
            'map_p_progress_panel': progress + "%",
            'map_p_nozzle': nozzle,
            'map_p_bed': bed
        };

        for (let [id, val] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        }

        // 3. Progress Bars
        const barDash = document.getElementById('dash-progress-bar-horizontal');
        if (barDash) barDash.style.width = progress + "%";

        const barDetail = document.getElementById('p_progress_bar_detail');
        if (barDetail) barDetail.style.width = progress + "%";

        const mapBar = document.getElementById('map_progress_bar_panel');
        if (mapBar) mapBar.style.width = progress + "%";

        // 4. Status Farbe
        const colorMap = {
            "printing": "#27ae60", "running": "#27ae60",
            "heatup": "#f1c40f", "prepare": "#f1c40f",
            "idle": "#bdc3c7", "finish": "#bdc3c7", "ready": "#bdc3c7",
            "offline": "#c0392b"
        };
        const statusColor = colorMap[state] || "#c0392b";

        const s1 = document.getElementById('p_status');
        const s2 = document.getElementById('p_status2');
        if (s1) s1.style.color = statusColor;
        if (s2) s2.style.color = statusColor;

    } catch (e) {
        // Fehlerbehandlung
        console.error("Printer Status Error:", e);
    }
}
//----------------------------------------------------------------------------------------------------------//
setInterval(updatePrinterStatus, 5000);

window.sendPrinterCommand = async function (cmd, param = "2") {
    if (typeof cmd === 'object' && cmd.target) {
        return;
    }

    try {
        const response = await fetch('/api/printer/command', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                command: cmd,
                param: param
            })
        });

        if (cmd === 'light_on' || cmd === 'light_off') {
            const overlay = document.getElementById('printerOverlayShade');
            if (overlay) {
                overlay.style.background = (cmd === 'light_on') ? "rgba(0, 0, 0, 0.1)" : "rgba(0, 0, 0, 0.3)";
            }
        }
    } catch (e) {
        console.error("Printer Command Error:", e);
    }
};

window.disconnectPrinter = async function () {
    if (!confirm("Drucker trennen?")) return;
    await postJSON("/api/printer/disconnect", {});
    closePrinterControl();
};

//----------------------------------------------------------------------------------------------------------//

window.openCloud = function () {
    hideAll();
    document.getElementById('cloudOverlay').style.display = 'block';
    loadCloudFiles();
};
window.closeCloud = showDashboard;

//----------------------------------------------------------------------------------------------------------//

async function submitCloudLogin() {
    const u = document.getElementById('nc_user').value;
    const p = document.getElementById('nc_pass').value;
    const res = await fetch('/api/cloud/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({user: u, pass: p})
    });
    if (res.ok) {
        document.getElementById('cloudLoginArea').style.display = 'none';
        document.getElementById('cloudContentArea').style.display = 'block';
        loadCloudFiles();
    } else {
        alert("Login Fehler");
    }
}

//----------------------------------------------------------------------------------------------------------//

async function loadCloudFiles() {
    const list = document.getElementById('fileList');
    if (!list) return;
    list.innerHTML = "<li>Lade...</li>";
    try {
        const res = await fetch('/api/cloud/files');
        const data = await res.json();
        list.innerHTML = "";
        if (data.files) {
            data.files.forEach(f => {
                const li = document.createElement('li');
                li.style.padding = "10px";
                li.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
                li.innerText = (f.name.includes('.') ? "📄 " : "📁 ") + f.name;
                list.appendChild(li);
            });
        }
    } catch (e) {
        list.innerHTML = "<li>Fehler beim Laden</li>";
    }
}

//----------------------------------------------------------------------------------------------------------//

let storedLat, storedLon;
let currentCity = localStorage.getItem('selectedWeatherCity') || 'Innsbruck';

window.openWeatherDetail = async function () {
    hideAll();
    const panel = document.getElementById('weatherDetailPanel');
    if (panel) panel.style.display = 'block';

    // Daten laden
    if (!storedLat) await fetchWeatherData();
    updateDetailView();
};
window.closeWeatherDetail = showDashboard;
//----------------------------------------------------------------------------------------------------------//

window.toggleCityInput = function () {
    const el = document.getElementById('cityInputArea');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
//----------------------------------------------------------------------------------------------------------//

window.updateWeatherCity = async function () {
    const input = document.getElementById('citySearchInput');
    if (input && input.value) {
        currentCity = input.value;
        localStorage.setItem('selectedWeatherCity', currentCity);
        document.getElementById('cityInputArea').style.display = 'none';
        await fetchWeatherData();
    }
};
//----------------------------------------------------------------------------------------------------------//

async function fetchWeatherData() {
    try {
        const geoReq = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(currentCity)}&count=1&language=de&format=json`);
        const geo = await geoReq.json();
        if (!geo.results) return;

        storedLat = geo.results[0].latitude;
        storedLon = geo.results[0].longitude;
        document.getElementById('cityNameDisplay').innerText = geo.results[0].name;

        const weatherReq = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${storedLat}&longitude=${storedLon}&current_weather=true&daily=weathercode,temperature_2m_max&timezone=auto`);
        const weather = await weatherReq.json();

        // Widget Update
        document.getElementById('currentTemp').innerText = Math.round(weather.current_weather.temperature) + "°C";
        document.getElementById('currentWeatherIcon').src = getWeatherIcon(weather.current_weather.weathercode);

        // HINTERGRUNDFARBE WIDGET
        const code = weather.current_weather.weathercode;
        const bg = document.getElementById('weatherBg');

        if (bg) {
            let bgColor;
            if (code === 0) {
                bgColor = "rgba(255, 165, 0, 0.4)"; // Sonnig
            } else if (code <= 3) {
                bgColor = "rgba(135, 206, 235, 0.2)"; // Leicht bewölkt
            } else if (code >= 51 && code <= 67) {
                bgColor = "rgba(44, 62, 80, 0.4)"; // Regen
            } else if (code >= 71 && code <= 77) {
                bgColor = "rgba(255, 255, 255, 0.2)"; // Schnee
            } else if (code >= 95) {
                bgColor = "rgba(75, 0, 130, 0.3)"; // Gewitter
            } else {
                bgColor = "rgba(100, 100, 100, 0.3)"; // Grau/Nebel
            }

            bg.style.background = bgColor;
            bg.style.transition = "background 2s ease-in-out";
        }

    } catch (e) {
        console.error("Weather Error:", e);
    }
}

//----------------------------------------------------------------------------------------------------------//
async function updateDetailView() {
    if (!storedLat) return;

    document.getElementById('detailCurrentTime').innerText = "--:--";

    // Hintergrund setzen
    const bgWidget = document.getElementById('weatherBg');
    const bgDetail = document.getElementById('weatherDetailBg');
    if (bgWidget && bgDetail) bgDetail.style.background = bgWidget.style.background;

    // Stadtname und Temp setzen
    document.getElementById('detailCityName').innerText = document.getElementById('cityNameDisplay').innerText;
    document.getElementById('detailCurrentTemp').innerText = document.getElementById('currentTemp').innerText;

    // 2. FETCHEN
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${storedLat}&longitude=${storedLon}&hourly=temperature_2m,weathercode&current_weather=true&timezone=auto`);
    const data = await res.json();

    const now = new Date();

    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);

    const cityTime = new Date(utcMs + (data.utc_offset_seconds * 1000));

    document.getElementById('detailCurrentTime').innerText = cityTime.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });


//----------------------------------------------------------------------------------------------------------//
    const timeline = document.getElementById('hourlyTimeline');
    if (timeline) {
        timeline.innerHTML = "";

        const currentHour = cityTime.getHours();

        for (let i = 0; i < 24; i++) {
            const t = Math.round(data.hourly.temperature_2m[i]);


            const dateObj = new Date(data.hourly.time[i]);
            const h = dateObj.getHours();

            const icon = getWeatherIcon(data.hourly.weathercode[i]);

            const div = document.createElement('div');
            const isCurrent = (h === currentHour); // Vergleich mit der Stadt-Zeit

            let bgStyle = "background:rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.05);";

            if (isCurrent) {
                bgStyle = "background: rgba(0, 140, 255, 0.6); border: 1px solid rgba(100, 200, 255, 0.8); box-shadow: 0 0 15px rgba(0, 140, 255, 0.4);";
                div.id = "activeWeatherHour";
            }

            div.style = `min-width:80px; text-align:center; ${bgStyle} padding:10px; border-radius:15px; transition: all 0.3s ease;`;

            // Zeige Stunde an
            div.innerHTML = `<small style="opacity:0.8">${h}:00</small><br><img src="${icon}" width="30" style="margin:5px 0;"><br><b style="font-size:1.1em">${t}°</b>`;

            timeline.appendChild(div);
        }

        // Scrollen zum aktiven Element
        setTimeout(() => {
            const activeEl = document.getElementById('activeWeatherHour');
            if (activeEl) {
                activeEl.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'});
            }
        }, 300);
    }

    const map = document.getElementById('weatherMap');
    if (map) map.src = `https://embed.windy.com/embed2.html?lat=${storedLat}&lon=${storedLon}&zoom=5&level=surface&overlay=rain&product=radar&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1`;
}

//----------------------------------------------------------------------------------------------------------//

function getWeatherIcon(code) {
    if (code === 0) return "https://img.icons8.com/fluency/96/sun.png";
    if (code <= 3) return "https://img.icons8.com/fluency/96/partly-cloudy-day.png";
    if (code >= 45 && code <= 48) return "https://img.icons8.com/fluency/96/fog-day.png";
    if (code >= 51 && code <= 67) return "https://img.icons8.com/fluency/96/rain.png";
    if (code >= 95) return "https://img.icons8.com/fluency/96/storm.png";
    return "https://img.icons8.com/fluency/96/cloud.png";
}

//----------------------------------------------------------------------------------------------------------//
let statusIntervalId = null;
const POLLING_INTERVAL = 5000; // Alle 5 Sekunden prüfen
async function fetchAndRenderStatusOnly() {
    // Nur pollen, wenn die Liste sichtbar ist
    if (document.getElementById("ledDeviceListPanel").style.display === 'none') return;

    try {
        const statuses = await (await fetch("/api/status")).json();

        statuses.forEach(statusDev => {
            const cleanMac = statusDev.mac.replace(/:/g, '');
            const statusElementId = `status-${cleanMac}`;
            const dotId = `dot-${cleanMac}`;
            const mapStatusEl = document.getElementById(`map_status-${cleanMac}`);
            if (mapStatusEl) {
                const isConnected = statusDev.connected === true || statusDev.connected === "true";
                const newText = isConnected ? "Connected" : "Disconnected";
                if (mapStatusEl.innerText !== newText) {
                    mapStatusEl.innerText = newText;
                    mapStatusEl.style.color = isConnected ? "#2ecc71" : "#fd0000";
                    const dot = mapStatusEl.nextElementSibling;
                    if (dot) dot.className = `device-status-dot ${isConnected ? 'active' : ''}`;
                }
            }
            const statusEl = document.getElementById(statusElementId);

            if (statusEl) {
                const isConnected = statusDev.connected === true || statusDev.connected === "true";

                const newText = isConnected ? "Connected" : "Disconnected";
                if (statusEl.innerText !== newText) {
                    statusEl.innerText = newText;
                    statusEl.style.color = isConnected ? "#2ecc71" : "#fd0000";

                    const dot = statusEl.nextElementSibling;
                    if (dot) dot.className = `device-status-dot ${isConnected ? 'active' : ''}`;
                }
            }

            const cachedDev = lastScannedDevices.find(d => d.mac === statusDev.mac);
            if (cachedDev) {
                cachedDev.connected = statusDev.connected;
            }
        });

    } catch (error) {
        console.error("Status Polling Error:", error);
    }
}

//----------------------------------------------------------------------------------------------------------//
function startStatusPolling() {
    if (statusIntervalId !== null) clearInterval(statusIntervalId);
    statusIntervalId = setInterval(fetchAndRenderStatusOnly, POLLING_INTERVAL);
}

//----------------------------------------------------------------------------------------------------------//
let isPrinterLightOn = false;

function togglePrinterLight() {
    isPrinterLightOn = !isPrinterLightOn; // Status umschalten
    const cmd = isPrinterLightOn ? 'light_on' : 'light_off';

    // Befehl senden
    sendPrinterCommand(cmd);

    // Button Style anpassen
    const btn = document.getElementById('btn-printer-light');
    if (btn) {
        if (isPrinterLightOn) {
            btn.style.background = "white";
            btn.style.color = "black";
            btn.style.boxShadow = "0 0 15px rgba(255,255,255,0.8)";
            btn.style.transform = "scale(1.05)";
        } else {
            btn.style.background = "";
            btn.style.color = "";
            btn.style.boxShadow = "";
            btn.style.transform = "";
        }
    }

}

//---------------------------------------------Logging-------------------------------------------------------------//

let logInterval = null;

function toggleLogWindow() {
    const el = document.getElementById('logOverlay');
    const isOpen = el.style.display === 'flex';

    if (isOpen) {
        // Schließen
        el.style.display = 'none';
        if (logInterval) clearInterval(logInterval);
    } else {
        // Öffnen
        el.style.display = 'flex';
        fetchLogs(); // Sofort laden
        logInterval = setInterval(fetchLogs, 2000); // Alle 2 Sekunden aktualisieren
    }
}

//---------------------------------------------Logging-------------------------------------------------------------//

async function fetchLogs() {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();

        const contentDiv = document.getElementById('logContent');
        // Logs umdrehen (neueste unten) und zusammenfügen
        contentDiv.innerText = logs.join('\n');

        // Automatisch nach unten scrollen
        contentDiv.scrollTop = contentDiv.scrollHeight;
    } catch (e) {
        console.error("Log Fetch Error", e);
    }
}

//----------------------------------------------------------------------------------------------------------//
window.openAutomationPanel = function() {
    hideAll();
    document.getElementById('automationPanel').style.display = 'block';
    updateAutomationUI(zimmerxxxAktiv);
};

//----------------------------------------------------------------------------------------------------------//

// ==========================================
// AUTOMATION LOGIK
// ==========================================

let automationStates = {
    "zimmer_xxx": false,
    "smart_motion": false,
    "darkness_trigger": false
};

const automationIdMap = {
    "zimmer_xxx": "xxxx",
    "smart_motion": "motion",
    "darkness_trigger": "darkness",
    "presence_trigger": "presence"
};

//----------------------------------------------------------------------------------------------------------//
async function checkAutomationStatus() {
    try {
        const response = await fetch('/api/automation/status');
        const data = await response.json();

        if(data.zimmer_christian) automationStates["zimmer_xxx"] = data.zimmer_christian.active;
        if(data.darkness_trigger) automationStates["darkness_trigger"] = data.darkness_trigger.active;

        if(data.presence_trigger) automationStates["presence_trigger"] = data.presence_trigger.active;


        updateAutomationUI("zimmer_xxx", automationStates["zimmer_christian"]);
        updateAutomationUI("darkness_trigger", automationStates["darkness_trigger"]);

        updateAutomationUI("presence_trigger", automationStates["presence_trigger"]);

    } catch (e) {
        console.error("Automation Status Error", e);
    }
}

//----------------------------------------------------------------------------------------------------------//
window.runZimmerxxx = async function() {
    const id = "zimmer_xxx";

    const selectedMacs = JSON.parse(localStorage.getItem('zimmer_automation_macs') || "[]");

    if (selectedMacs.length === 0) {
        alert("Bitte klicke auf den Stift und wähle zuerst Geräte aus!");
        return;
    }

    const currentState = automationStates[id];
    const targetState = !currentState;
    const newStateStr = targetState ? "on" : "off";

    automationStates[id] = targetState;
    updateAutomationUI(id, targetState);


    await sendAutomationToggle(id, targetState);

    console.log(`[Automation] Starte für ${selectedMacs.length} Geräte...`);

    for (const mac of selectedMacs) {
        try {
            await fetch("/api/connect", {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ mac: mac })
            });

            await fetch("/api/power", {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ state: newStateStr })
            });

            console.log(`[Automation] ${mac} ist jetzt ${newStateStr}`);
        } catch (err) {
            console.error(`Fehler bei Gerät ${mac}:`, err);
        }
    }
};


//----------------------------------------------------------------------------------------------------------//
async function toggleDarknessTrigger() {
    const id = "darkness_trigger";
    const newState = !automationStates[id];
    await sendAutomationToggle(id, newState);
}

//----------------------------------------------------------------------------------------------------------//
async function sendAutomationToggle(id, active) {
    try {
        const response = await fetch(`/api/automation/toggle/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ active: active })
        });
        const data = await response.json();

        if (data.status === "success") {
            automationStates[id] = active;
            updateAutomationUI(id, active);
        }
    } catch (e) {
        console.error("Toggle Error", e);
        automationStates[id] = !active;
        updateAutomationUI(id, !active);
    }
}

//----------------------------------------------------------------------------------------------------------//
function updateAutomationUI(backendId, isActive) {
    const suffix = automationIdMap[backendId];
    if (!suffix) return;

    const textEl = document.getElementById(`status-text-${suffix}`);
    const dotEl = document.getElementById(`dot-${suffix}`);

    if (textEl && dotEl) {
        if (isActive) {
            textEl.innerText = "Aktiv";
            textEl.style.color = "#2ecc71";
            textEl.style.opacity = "1";
            textEl.style.fontWeight = "bold";

            dotEl.style.background = "#2ecc71";
            dotEl.style.boxShadow = "0 0 10px #2ecc71";
        } else {
            textEl.innerText = "Starten";
            textEl.style.color = "white";
            textEl.style.opacity = "0.7";
            textEl.style.fontWeight = "normal";

            dotEl.style.background = "rgba(255,255,255,0.1)";
            dotEl.style.boxShadow = "none";
        }
    }
}
//----------------------------------------------------------------------------------------------------------//
async function startNFCScan() {
    const statusText = document.getElementById('nfc-status');
    const resultText = document.getElementById('nfc-result');

    statusText.innerText = "Scan...";
    resultText.innerText = "Wait for Card...";

    try {
        const response = await fetch('/api/nfc/scan');
        const data = await response.json();

        if (data.status === "success") {
            statusText.innerText = "Card found!";
            resultText.innerText = "UID: " + data.uid;

            // Logik für Admin-UID: Panel öffnen
            if (data.is_admin) {
                console.log("Admin found! Open Control Panel...");
                setTimeout(() => {
                    openNFCControlPanel();
                }, 1000);
            }
        } else {
            statusText.innerText = "No Card found";
            resultText.innerText = "ID: ----";
        }
    } catch (error) {
        statusText.innerText = "Error";
    }
}
//----------------------------------------------------------------------------------------------------------//
async function openNFCControlPanel() {
    hideAll();
    document.getElementById('nfcControlPanel').style.display = 'block';

    // Daten aus der API laden
    try {
        const response = await fetch('/api/nfc/logs');
        const logs = await response.json();
        const tableBody = document.getElementById('nfc-log-table');

        // Tabelle leeren und neu füllen (neueste zuerst)
        tableBody.innerHTML = "";
        logs.reverse().forEach(entry => {
            const row = `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px; font-size: 0.9rem; opacity: 0.8;">${entry.timestamp}</td>
                    <td style="padding: 10px; font-family: monospace; color: var(--accent-color);">${entry.uid}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (err) {
        console.error("Error loading NFC-Log:", err);
    }
}
//----------------------------------------------------------------------------------------------------------//
function toggleSidebar() {
    const sidebar = document.getElementById('widget-sidebar');
    const toggle = document.getElementById('sidebar-toggle');

    sidebar.classList.toggle('open');

    if (sidebar.classList.contains('open')) {
        toggle.style.right = '300px';
        toggle.style.transform = 'translateY(-50%) rotate(180deg)';
        toggle.style.background = 'rgba(255, 255, 255, 0.2)';
    } else {
        toggle.style.right = '0';
        toggle.style.transform = 'translateY(-50%) rotate(0deg)';
        toggle.style.background = 'rgba(255, 255, 255, 0.1)';
    }
}
//----------------------------------------------------------------------------------------------------------//

// Widget an/aus schalten und speichern
window.toggleWidget = function(widgetId, isVisible) {
    const widget = document.getElementById(widgetId);
    if (widget) {
        const displayType = (widgetId === 'btc-widget') ? 'flex' : 'block';

        widget.style.display = isVisible ? displayType : 'none';

        // Zustand im localStorage speichern
        let widgetSettings = JSON.parse(localStorage.getItem('user_widget_settings') || "{}");
        widgetSettings[widgetId] = isVisible;
        localStorage.setItem('user_widget_settings', JSON.stringify(widgetSettings));
    }
};

//----------------------------------------------------------------------------------------------------------//
function loadWidgetSettings() {
    const widgetSettings = JSON.parse(localStorage.getItem('user_widget_settings') || "{}");

    for (const [widgetId, isVisible] of Object.entries(widgetSettings)) {
        const widget = document.getElementById(widgetId);

        const checkbox = document.querySelector(`input[onclick*="${widgetId}"]`);

        if (widget) {
            const displayType = (widgetId === 'btc-widget') ? 'flex' : 'block';
            widget.style.display = isVisible ? displayType : 'none';
        }

        if (checkbox) {
            checkbox.checked = isVisible;
        }
    }
}
//----------------------------------------------------------------------------------------------------------//
// Öffnet/Schließt das Auswahlmenü
window.toggleDevicePicker = async function() {
    const overlay = document.getElementById('device-picker-overlay');
    if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        await loadPickerDevices();
    } else {
        overlay.style.display = 'none';
    }
};
//----------------------------------------------------------------------------------------------------------//

async function loadPickerDevices() {
    try {
        const response = await fetch('/api/known_devices');
        const devices = await response.json();
        const listContainer = document.getElementById('picker-device-list');

        if (!listContainer) return;

        const savedData = localStorage.getItem('zimmer_automation_macs');
        const selectedMacs = savedData ? JSON.parse(savedData).map(m => m.toUpperCase()) : [];

        listContainer.innerHTML = devices.map(d => {
            const currentMac = d.mac.toUpperCase();
            const isChecked = selectedMacs.includes(currentMac) ? 'checked' : '';

            return `
                <div style="display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <input type="checkbox" value="${d.mac}" ${isChecked} style="width: 20px; height: 20px;">
                    <div>
                        <div style="font-weight: bold;">${d.name || 'Unbekannt'}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Fehler beim Laden der Picker-Liste:", err);
    }
}
//----------------------------------------------------------------------------------------------------------//
// Speichert die Auswahl dauerhaft im Browser
window.saveAutomationDevices = function() {
    const checkboxes = document.querySelectorAll('#picker-device-list input:checked');
    const selectedMacs = Array.from(checkboxes).map(cb => cb.value.toUpperCase());

    localStorage.setItem('zimmer_automation_macs', JSON.stringify(selectedMacs));
    toggleDevicePicker();
    console.log("Automation aktualisiert auf:", selectedMacs);
};

//----------------------------------------------------------------------------------------------------------//
document.addEventListener("DOMContentLoaded", () => {
    const modelViewer = document.getElementById("home-viewer");

    if (modelViewer) {
        console.log("🚀 Koordinaten-Sucher gestartet! Warte auf Klick...");

        modelViewer.addEventListener('click', (event) => {
            // 1. Prüfen, ob das Modell bereit ist
            if (!modelViewer.loaded) {
                console.warn("⏳ Modell lädt noch... bitte kurz warten!");
                return;
            }

            // 2. Klick-Position berechnen
            const rect = modelViewer.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            console.log(`Versuche Position zu finden bei X: ${x}, Y: ${y}`);

            // 3. Den Viewer fragen
            const hit = modelViewer.positionAndNormalFromPoint(x, y);

            // 4. Ergebnis auswerten
            if (hit != null) {
                const { x: px, y: py, z: pz } = hit.position;

                // Formatiert den String
                const posString = `${px.toFixed(2)}m ${py.toFixed(2)}m ${pz.toFixed(2)}m`;
                const fullTag = `data-position="${posString}"`;

                // Ausgabe in der Konsole (groß und grün)
                console.log("%c✅ TREFFER!", "color: lime; font-size: 20px; font-weight: bold;");
                console.log("%cKopiere diese Zeile:", "color: white; font-size: 14px;");
                console.log(`%c${fullTag}`, "color: yellow; background: #333; padding: 5px; font-size: 16px;");
            } else {
                console.log("%c❌ DANEBEN", "color: red; font-weight: bold;");
                console.log("Der Klick hat das Haus nicht getroffen. Versuch es mal genau in der Mitte einer Wand.");
            }
        });
    } else {
        console.error("Fehler: Konnte das Element #home-viewer nicht finden!");
    }
});
//-------------------------------------------------------------------------------------------------------//
function togglePresenceTrigger() {
    const statusText = document.getElementById("status-text-presence");
    const isCurrentlyActive = statusText.innerText === "Aktiv";
    const newState = !isCurrentlyActive;

    fetch('/api/automation/toggle/presence_trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newState })
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === "success") {
            updateAutomationUI("presence_trigger", data.state.active);
        }
    })
    .catch(err => console.error("Fehler beim Togglen:", err));
}
//-------------------------------------------------------------------------------------------------------//
/* --- INIT --- */
document.addEventListener("DOMContentLoaded", function () {
    loadKnownDevices();
    startStatusPolling();
    updatePrinterStatus();
    fetchWeatherData();
    loadWidgetSettings();
    updateLightSensor();
    updatePlantSensors();
    checkAutomationStatus();

    // Intervalle starten (Licht alle 2s, Pflanze alle 30000s reicht meistens) change for commercial use
    setInterval(updateLightSensor, 5000);
    setInterval(updatePlantSensors, 5000);
    setInterval(checkAutomationStatus, 2000);
});