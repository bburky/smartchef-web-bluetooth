var myCharacteristic;

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
  0b0001000: "ml",
  0b1001000: "lb", // Chipsea-BLE, marked ib
  0b0110000: "lb", // smartchef, marked ib
};



const connectButton = document.getElementById("connect");
connectButton.addEventListener("click", onConnectButtonClick);

const output = document.getElementById("output");
let device;
let server;

function log(s) {
  console.log(s);
}

async function onConnectButtonClick() {
  if (device && server) {
    disconnect();
  } else if (device) {
    // The user is likely attempting to disconect during reconnection
    // The API doesn't actually allow this really: https://issues.chromium.org/issues/40502943
    // For now, discard the device and attempt a full initial connection
    device = null;
    connectButton.textContent = "Connecting...";
    await connect();
    connectButton.textContent = "Disconnect";
  } else {
    try {
      connectButton.textContent = "Connecting...";
      await connect();
      connectButton.textContent = "Disconnect";
    } catch (error) {
      log("Argh! " + error);
      connectButton.textContent = "Connect";
    }
  }
}

async function connect() {
  if (!device) {
    device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          namePrefix: "Chipsea-BLE",
        },
        {
          namePrefix: "smartchef",
        },
      ],
      optionalServices: [SCALE_SERVICE_UUID],
    });
    device.addEventListener("gattserverdisconnected", onDisconnected);
  }

  newServer = await device.gatt.connect();
  // It's impossible to cancel the connect() call, the browser will attempt to reconnect forever
  // Therefore this app will abandon calls to connect sometimes, but that means that two will run in parallel
  // Detect if an abandoned connect() succeeds and throw an error to indicate it was cancelled
  if (server) {
    throw new Error("cancelled");
  }
  server = newServer;

  const service = await server.getPrimaryService(SCALE_SERVICE_UUID);

  characteristic = await service.getCharacteristic(SCALE_CHARACTERISTIC_UUID);
  characteristic.addEventListener(
    "characteristicvaluechanged",
    handleNotifications
  );
  await characteristic.startNotifications();
}

function disconnect() {
  if (device.gatt.connected) {
    // Clear device variable to block automatic reconnection
    const deviceToDisconnect = device;
    device = null;
    deviceToDisconnect.gatt.disconnect();
  }
}

async function onDisconnected() {
  connectButton.textContent = "Reconnecting...";
  server = null;
  if (device) {
    try {
      server = await connect();
      connectButton.textContent = "Disconnect";
      return;
    } catch (error) {
      log("Argh! " + error);
    }
  }
  device = null;
  connectButton.textContent = "Connect";
}

async function onStopButtonClick() {
  if (myCharacteristic) {
    try {
      await myCharacteristic.stopNotifications();
      log("> Notifications stopped");
      myCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        handleNotifications
      );
    } catch (error) {
      log("Argh! " + error);
    }
  }
}

function handleNotifications(event) {
  let value = new Uint8Array(event.target.value.buffer);

  // Based on:
  // #1 https://github.com/oliexdev/openScale/issues/496
  // #2 https://github.com/oliexdev/openScale/files/5224454/OKOK.Protocol.pdf
  // #3 https://raw.githubusercontent.com/mxiaoguang/chipsea-ble-lib/master/%E8%8A%AF%E6%B5%B7%E8%93%9D%E7%89%99%E7%A7%A4%E4%BA%91%E7%AB%AF%E7%89%88%E9%80%9A%E8%AE%AF%E5%8D%8F%E8%AE%AE%20v3.pdf

  const {
    0: magic,
    1: protocolVersion,
    3: attributes, // This seems to decode according to Table 1 in #2
    5: weightMSB,
    6: weightLSB,
  } = value;
  if (magic != 0xca) {
    return;
  }
  if (protocolVersion != 0x10) {
    // My scale uses protocol version 0x10, which seems very similar to 0x11 documented
    return;
  }
  if (value.slice(1).reduce((sum, d) => sum ^ d) != 0) {
    // trace("ScaleClient: invalid checksum\n");
    return;
  }
  const sign = attributes & 0b10000000 ? -1 : 1;
  const locked = attributes & 0b1;
  const decimals = DECIMALS[attributes & 0b110];
  const unit = UNITS[attributes & 0b1111000];
  const weight = (((weightMSB << 8) + weightLSB) / 10 ** decimals * sign).toFixed(
    decimals
  );

  // console.log("sign",     (attributes & 0b10000000).toString(2));
  // console.log("locked",   (attributes & 0b00000001).toString(2));
  // console.log("decimals", (attributes & 0b00000110).toString(2));
  // console.log("unit?",    (attributes & 0b01111000).toString(2));

  output.textContent = `${weight} ${unit}`;
  output.className = locked ? "locked" : "";
}
