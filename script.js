var myCharacteristic;

const SCALE_SERVICE_UUID = 0xFFF0;
const SCALE_CHARACTERISTIC_UUID = 0xFFF1;

function log(s) {
  document.write(s);
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
  // Convert raw data bytes to hex values just for the sake of showing something.
  // In the "real" world, you'd use data.getUint8, data.getUint16 or even
  // TextDecoder to process raw data bytes.
  for (let i = 0; i < value.byteLength; i++) {
    a.push("0x" + ("00" + value.getUint8(i).toString(16)).slice(-2));
  }
  log("> " + a.join(" "));
}
