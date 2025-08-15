# Unofficial [Smart Chef][1] Bluetooth smart scale webapp

Simple webapp to display the value from a [Smart Chef][1] Bluetooth scale using [Web Bluetooth][2]. Tested with the [500g][3] and [3000g][4] scales, model RX402b20, but could possibly be extended to support other Bluetooth scales using the same protocol.

I had no end of trouble using the official [Smart Chef Android app][5] (but I honestly haven't even tried it recently), so I wrote this small PWA as a replacement phone app. At some point I may reimplement other features in the official app, like a log or the pour over coffee timer. I'll probably make separate dedicated PWAs for these.

Features:

- Shows value from scale, with correct units and decimal precision
- Automatic reconnection on Bluetooth disconnection
- Installable as a Portable Web Application: home screen icon, full screen UI, ~~offline support~~
- [Screen Wake Lock][6] to prevent the screen from going off while you use the scale
- _mL_ unit replaced with _fl oz_ (the _mL_ unit was effectively a duplicage of _g_)

[1]: https://smartchef.me/
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
[3]: https://www.amazon.com/dp/B009LCM93O
[4]: https://www.amazon.com/dp/B009LCM90C
[5]: https://play.google.com/store/apps/details?id=com.reflex.ww.smartfoodscale&hl=en_US&gl=US
[6]: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API

Bugs:

- Offline PWA isn't quite finished

There is a hidden debug 🐞 button that can be accessed by clicking under the top-right text on screen 4 times. This will show some logs on screen. The logs are also written to the JS console log, but this is useful to see the logs on mobile.

_You may ask why a kitchen scale needs Bluetooth... but the small scale is hard to see under a large mixing bowl or something. A large phone screen is great to easily read. Plus phone apps can have extra features like the aforementioned pour over coffee timer which measures coffee grounds, measures water and provides an integrated timer._
