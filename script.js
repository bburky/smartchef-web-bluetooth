var myCharacteristic;

const SCALE_SERVICE_UUID = 0xFFF0;
const SCALE_CHARACTERISTIC_UUID = 0xFFF1;

const DECIMALS = {
	0b000: 0,
	0b010: 1,
	0b100: 2,
}

const connectButton = document.getElementById("connect");
connectButton.addEventListener("click", onConnectButtonClick);

const output = document.getElementById("output");
let device;
let server;

function log(s) {
  console.log(s);
}

async function onConnectButtonClick() {
  if (device) {
    disconnect();
  } else {
    connect();
  }
}


async function connect(connectingMessage = "Connecting...") {
  try {
    connectButton.textContent = connectingMessage;
    
    device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          namePrefix: "Chipsea-BLE",
        },
      ],
      optionalServices: [SCALE_SERVICE_UUID],
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);
    server = await device.gatt.connect();

    const service = await server.getPrimaryService(SCALE_SERVICE_UUID);

    myCharacteristic = await service.getCharacteristic(
      SCALE_CHARACTERISTIC_UUID
    );
    myCharacteristic.addEventListener(
      "characteristicvaluechanged",
      handleNotifications
    );
    await myCharacteristic.startNotifications();

    connectButton.textContent = "Disconnect";
  } catch (error) {
    log("Argh! " + error);
    connectButton.textContent = "Connect";
  }
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
  if (device) {
    for (let i = 0; i < 3; i++) {
      try {
        server = await device.gatt.connect("Reconnecting...");
        return;        
      } catch (error) {
        log("Argh! " + error);
      }
    }
  }
  server = null;
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

  // Based on https://github.com/oliexdev/openScale/issues/496
  // https://github.com/oliexdev/openScale/files/5224454/OKOK.Protocol.pdf  
  // https://raw.githubusercontent.com/mxiaoguang/chipsea-ble-lib/master/%E8%8A%AF%E6%B5%B7%E8%93%9D%E7%89%99%E7%A7%A4%E4%BA%91%E7%AB%AF%E7%89%88%E9%80%9A%E8%AE%AF%E5%8D%8F%E8%AE%AE%20v3.pdf
  
  const {
    0: magic,
    1: protocolVersion,
    3: attributes, // This may be "device type", but it seems to decode according to Table 1
    5: weightMSB,
    6: weightLSB,
  } = value;
  if (magic != 0xCA) {
    return;
  }
  if (protocolVersion != 0x10) {
    // My scale uses protocol version 0x10, which seems very similar to 0x11
    return;
  }
  if (value.slice(1).reduce((sum, d) => sum ^ d) != 0) {
    // trace("ScaleClient: invalid checksum\n");
    return;
  }
  const sign = attributes & 0b1000000 ? -1 : 1;
  const locked = attributes & 0b1;
  const decimals = sign * DECIMALS[attributes & 0b110];
  const weight = (((weightMSB << 8) + weightLSB) / 10**decimals).toFixed(decimals);

  // todo
  console.log((attributes & 0b01111000).toString(2));
  
  output.textContent = weight;
  output.className = locked ? 'locked' : '';
}
