const SCALE_SERVICE_UUID = 0xfff0;
const SCALE_CHARACTERISTIC_UUID = 0xfff1;
const DECIMALS = {
  0b000: 0,
  0b010: 1,
  0b100: 2,
  0b110: 3,
};
const UNITS = {
  0b0000000: "g",
  0b0001000: "mL",
  0b1001000: "lb", // Chipsea-BLE, marked "ib"
  0b0110000: "lb", // smartchef, marked "ib"
};

let device;
let server;
let wakeLock;
let installPrompt;
let debugClickedCount = 0;

// Hook up app's Connect button and output elements
const installButton = document.getElementById("install");
const output = document.getElementById("output");
const debugButton = document.getElementById("debug");
const debugOutput = document.getElementById("debug-output");
debugButton.addEventListener("click", onDebugButtonClick);
const connectButton = document.getElementById("connect");
connectButton.addEventListener("click", onConnectButtonClick);
const errorMessage = document.getElementById("error");

// Install service worker, required to meet PWA installability criteria in Chrome
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./serviceworker.js");
}

//  PWA install button
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.removeAttribute("hidden");
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  const result = await installPrompt.prompt();
  log(`Install prompt result: ${result.outcome}`);
  disableInAppInstallPrompt();
});
function disableInAppInstallPrompt() {
  installPrompt = null;
  installButton.setAttribute("hidden", "");
}

// Enable Connect button to access app if checks pass
if (inIframe()) {
  document.body.className = "iframed";
  errorMessage.textContent = "⚠️ Bluetooth cannot be accessed in an embedded website. ";
  const link = document.createElement("a");
  link.target = "_top"; // Cannot use _blank, Glitch iframes do not have allow-popups permissions
  link.href = document.location;
  link.textContent = "Click here to open in a new window.";
  errorMessage.appendChild(link);
} else if ("bluetooth" in navigator) {
  connectButton.removeAttribute("disabled");
  errorMessage.setAttribute("hidden", "");
}

function log(s) {
  debugOutput.textContent += s + "\n";
  console.log(s);
}

function error(e) {
  debugOutput.textContent += e + "\n";
  console.error(e);
  if (e.name == "NotFoundError") {
    // Don't display an error if the user just cancels the Bluetooth connect dialog
    return;
  }
  errorMessage.removeAttribute("hidden");
  errorMessage.textContent = `⚠️ ${e}`;
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

class ProtocolError extends Error {
  constructor(message = "", ...args) {
    super(message, ...args);
    this.name = "ProtocolError";
    this.message = message ? message : "Received unprocessable data from device. This may be an incompatible model of bluetooth scale?";
  }
}

class Cancelled extends Error {
  constructor(message = "", ...args) {
    super(message, ...args);
    this.name = "Cancelled";
  }
}

// Show a debug button after 3 clicks and activate on 4th click
// Button is invisible below the top right text
function onDebugButtonClick() {
  debugClickedCount++;
  if (debugClickedCount == 3) {
    debugButton.className = "";
  } else if (debugClickedCount >= 4) {
    toggleDebug();
  }
}
function toggleDebug() {
  if (debugOutput.hasAttribute("hidden")) {
    debugOutput.removeAttribute("hidden");
  } else {
    debugOutput.setAttribute("hidden", "");
  }
}

async function onConnectButtonClick() {
  // Hide any visible error message
  errorMessage.setAttribute("hidden", "");

  if (device && server) {
    log("onConnectButtonClick() disconnect connected device");
    disconnect();
    return;
  } else if (device) {
    log("onConnectButtonClick() disconnect during reconnection");

    // The user is likely attempting to disconect during reconnection
    // The API doesn't actually allow cancelling a connect() call: https://issues.chromium.org/issues/40502943
    // Attempt to disconnect it anyway though, and then discard the device and attempt a full initial connection
    device.gatt.disconnect();
    device = null;
  }

  log("onConnectButtonClick() connect");
  connectButton.textContent = "Connecting...";
  try {
    await connect();
    connectButton.textContent = "Disconnect";
  } catch (e) {
    error(e);
    connectButton.textContent = "Connect";
  }
}

async function connect() {
  log("connect()");

  let currentDevice;

  if (device) {
    currentDevice = device;
  } else {
    log("connect() requestDevice()");
    currentDevice = await navigator.bluetooth.requestDevice({
      filters: [
        {
          // 500g Smart Chef Smart Food Scale
          namePrefix: "smartchef",
        },
        {
          // 3000g Smart Chef Smart Food Scale
          namePrefix: "Chipsea-BLE",
        },
      ],
      optionalServices: [SCALE_SERVICE_UUID],
    });
    currentDevice.addEventListener("gattserverdisconnected", onDisconnected);
    device = currentDevice;
    log("connect() requestDevice() succeeded");
  }

  log("connect() gatt.connect()");
  const newServer = await currentDevice.gatt.connect();
  log("connect() gatt.connect() succeeded");
  // It's impossible to cancel the connect() call, the browser will attempt to reconnect forever
  // Therefore this app will abandon calls to connect sometimes, but that means that multiple connect attempts may run in parallel
  // Detect if an abandoned connect() succeeds and throw an error to indicate it was cancelled
  if (!device || server) {
    currentDevice.gatt.disconnect();
    throw new Cancelled();
  }
  server = newServer;

  const service = await server.getPrimaryService(SCALE_SERVICE_UUID);

  const characteristic = await service.getCharacteristic(
    SCALE_CHARACTERISTIC_UUID
  );
  characteristic.addEventListener(
    "characteristicvaluechanged",
    handleNotifications
  );
  await characteristic.startNotifications();

  if ("wakeLock" in navigator) {
    log("connect() wakeLock.request()");
    wakeLock = await navigator.wakeLock.request();
    wakeLock.addEventListener("release", () => {
      log("Wake Lock has been released");
    });
  }

  log("connect() succeeded");
}

function disconnect() {
  log("disconnect()");

  if (device.gatt.connected) {
    // Clear device variable to block automatic reconnection
    const currentDevice = device;
    device = null;

    currentDevice.gatt.disconnect();
  }
}

async function onDisconnected() {
  output.textContent = "- - -";
  output.className = "";
  server = null;
  if (device) {
    try {
      log("onDisconnected() reconnecting");
      connectButton.textContent = "Reconnecting...";
      server = await connect();
      connectButton.textContent = "Disconnect";
      return;
    } catch (e) {
      if (e instanceof Cancelled) {
        log("onDisconnected() caught Cancelled");
        return;
      }
      error(e);
    }
  }

  log("onDisconnected() disconnected");
  device = null;
  connectButton.textContent = "Connect";
  if (wakeLock) {
    wakeLock.release();
  }
}

function handleNotifications(event) {
  try {
    let value = new Uint8Array(event.target.value.buffer);

    // Based on:
    // #1 https://github.com/oliexdev/openScale/issues/496
    // #2 https://github.com/oliexdev/openScale/files/5224454/OKOK.Protocol.pdf
    // #3 https://raw.githubusercontent.com/mxiaoguang/chipsea-ble-lib/master/%E8%8A%AF%E6%B5%B7%E8%93%9D%E7%89%99%E7%A7%A4%E4%BA%91%E7%AB%AF%E7%89%88%E9%80%9A%E8%AE%AF%E5%8D%8F%E8%AE%AE%20v3.pdf
    // and some manual reverse engineering

    // This is JavaScript feature is the most wonderfully bizarre way to destructure an array I've ever used
    const {
      0: magic,
      1: protocolVersion,
      3: attributes, // This mostly seems to decode according to Table 1 in document #2 linked above
      5: weightMSB,
      6: weightLSB,
    } = value;
    if (magic != 0xca) {
      log("handleNotifications() invalid magic");
      throw new ProtocolError();
    }
    if (protocolVersion != 0x10) {
      log("handleNotifications() invalid protocolVersion");
      // My scale uses protocol version 0x10, which seems very similar to 0x11 documented
      throw new ProtocolError();
    }
    if (value.slice(1).reduce((sum, d) => sum ^ d) != 0) {
      log("handleNotifications() invalid checksum");
      // TODO: could just silently drop packets with checksum errors
      throw new ProtocolError();
    }

    const locked =            attributes & 0b00000001;
    const decimals = DECIMALS[attributes & 0b00000110];
    let unit =          UNITS[attributes & 0b01111000];
    const sign =              attributes & 0b10000000 ? -1 : 1;

    let weight = (((weightMSB << 8) + weightLSB) / 10 ** decimals) * sign;
    let weightStr = weight.toFixed(decimals);

    // Subtract one to skip the decimal point, unless no decimals
    const precision = decimals == 0 ? weightStr.length : weightStr.length - 1
    
    // TODO add a drop down UI to select units
    // For now, just replace the useless mL unit (same number as g, why does it exist?) with fl oz
    if (unit == "mL") {
      unit = "fl oz";
      weight *= 0.033814;
      weightStr = weight.toPrecision(precision)
    }
    
    // log(`handleNotifications() raw data ${[...value].map(e => e.toLocaleString('en', {minimumIntegerDigits:3}))}`);

    output.textContent = `${weightStr} ${unit}`;
    output.className = locked ? "locked" : "";
  } catch (e) {
    disconnect();
    error(e);
  }
}
