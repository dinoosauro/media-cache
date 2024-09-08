/**
 * This content script is isolated, so it doesn't affect the main webpage content (the main "script.js" is exposed since it needs to edit the prototype).
 * It's currently used only as a bridge between the extension UI and the main script
 */
(() => {
    /**
     * The browser interface to use
     * @type chrome
     */
    const browserToUse = typeof chrome === "undefined" ? browser : chrome;
    const comms = new BroadcastChannel("CUSTOM_MEDIACACHE_EXTENSION_COMMUNICATION"); // This is replaced every time the extension is built
    comms.onmessage = (msg) => { // Send back the message to the extension runtime
        browserToUse.runtime.sendMessage(msg.data);
    }
    browserToUse.runtime.onMessage.addListener((msg, _, response) => { // Send the message to the exposed script
        if (msg.action === "ping") {
            response({ action: "ping", content: "pong" });
            return;
        }
        comms.postMessage({ from: "a", ...msg });
    })
})();
