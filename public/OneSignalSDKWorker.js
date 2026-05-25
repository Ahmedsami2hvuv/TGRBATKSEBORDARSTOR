// Prevent 'message' event handler warning by adding it in the initial evaluation
self.addEventListener('message', () => { });

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
