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
        switch (msg.data.action) {
            case "uploadBytes": { // The buffer should be sent to the server. We'll also make sure to notify the main script about the success/failure of the operation.
                browserToUse.storage.sync.get(["server_link"]).then(obj => {
                    if (obj["server_link"]) {
                        fetch(`${obj["server_link"]}/upload/?filename=${encodeURIComponent(msg.data.content.name)}&position=${msg.data.content.position}`, {
                            method: "PUT",
                            body: msg.data.content.buffer
                        }).then(res => { 
                            comms.postMessage({from: "a", action: "resolvePromise", content: {id: msg.data.content.id, success: res.ok}});
                        }).catch(err => {
                            console.error(err);
                            comms.postMessage({from: "a", action: "resolvePromise", content: {id: msg.data.content.id, success: false}});
                        })
                    } else comms.postMessage({from: "a", action: "resolvePromise", content: {id: msg.data.content.id, success: false}});
                }).catch(() => {
                    comms.postMessage({from: "a", action: "resolvePromise", content: {id: msg.data.content.id, success: false}});
                })
                break;
            }
            case "getChoices": { // Return the custom behavior settings that are being used in the content script. Note that we need to replace the server_link property with the real string, since the content script knows only if the server mode is being used or not, and not the server URL.
                browserToUse.storage.sync.get(["server_link"]).then(obj => {
                    browserToUse.runtime.sendMessage({
                        ...msg.data,
                        content: {
                            ...msg.data.content,
                            server_link: obj.server_link || ""
                        }
                    })
                })
                break;
            }
            default: {
                browserToUse.runtime.sendMessage(msg.data);
                break;
            }
        }
        
    }
    browserToUse.runtime.onMessage.addListener((msg, _, response) => { // Send the message to the exposed script
        if (msg.action === "ping") {
            response({ action: "ping", content: "pong" });
            return;
        }
        if ((msg.action === "updateChoices" || msg.action === "getChoices") && typeof msg.content?.server_link !== "undefined" ) msg.content.server_link = !!msg.content.server_link; // The script doesn't need to know the URL of the server, so we can just replace it with a true/false, indicating if the server mode should be used or not.
        comms.postMessage({ from: "a", ...msg });
    })
})();
