// A fake service worker to meet PWA installability criteria in Chrome

self.addEventListener('fetch', function() {
    return;
});

// TODO: a real service worker that acutally works work offline

// const APP_STATIC_RESOURCES = [
//   "/",
//   "/index.html",
//   "/style.css",
//   "/script.js",
//   "/serviceworker.js", // ?
//   "/manifest.json", // ?
//   "https://cdn.glitch.com/605e2a51-d45f-4d87-a285-9410ad350515%2FLogo_Color.svg?v=1618199565140",
//   "https://cdn.glitch.me/605e2a51-d45f-4d87-a285-9410ad350515%2FHKGrotesk-Regular.otf?v=1603136326027",
//   "https://cdn.glitch.me/605e2a51-d45f-4d87-a285-9410ad350515%2FHKGrotesk-Bold.otf?v=1603136323437",
// ];
