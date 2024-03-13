var myCharacteristic;

const SCALE_SERVICE_UUID = 0xFFF0;
const SCALE_CHARACTERISTIC_UUID = 0xFFF1;

function log(s) {
  document.write(s + "\n");
}

document.getElementById("start").addEventListener("click", onStartButtonClick);
document.getElementById("stop").addEventListener("click", onStopButtonClick);

async function onStartButtonClick() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          namePrefix: "Chipsea-BLE",
        },
      ],
      optionalServices: [SCALE_SERVICE_UUID],
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SCALE_SERVICE_UUID);
    myCharacteristic = await service.getCharacteristic(
      SCALE_CHARACTERISTIC_UUID
    );

    await myCharacteristic.startNotifications();

    log("> Notifications started");
    myCharacteristic.addEventListener(
      "characteristicvaluechanged",
      handleNotifications
    );
  } catch (error) {
    log("Argh! " + error);
  }
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
  let value = event.target.value;
  let a = [];

  const {
    magic = data,
    protocolVersion = data,
    messageBodyProperties = data, // This may be "device type", but it seems to decode according to Table 1
    weightMSB = data,
    weightLSB = data,
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
  const decimals = DECIMALS[messageBodyProperties & 0b110];
  const weight = (((weightMSB << 8) + weightLSB) / 10**decimals).toFixed(decimals);
  
  log("> " + weight);
}
