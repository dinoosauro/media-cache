(async () => {
    const result = await navigator.serviceWorker.register('./serviceWorker.js', { scope: window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1) });
    if (navigator.onLine) await result.update();
    const selectVideoBtn = document.getElementById("selectVideo");
    const selectJsonBtn = document.getElementById("selectJson");
    const progress = document.getElementById("progress");
    let promise = { 
        /**
         * The ID property is never modified, and it's used to identify the content that is being sent from this window from the others.
         */
        id: crypto.randomUUID(), 
        /**
         * The function to call to resolve the Promise that is blocking the process
         * @type () => void
         */
        promise: null 
    };
    /**
     * @type File
     */
    let videoFile;
    const comms = new BroadcastChannel("comms");
    comms.onmessage = (msg) => {
        if (msg.data === promise.id) promise.promise();
    }
    /**
     * Show the button to pick the JSON file
     */
    function goToStep2() {
        document.getElementById("selectVideoDiv").style.display = "none";
        selectJsonBtn.style.display = "block";
    }
    selectVideoBtn.addEventListener("click", () => {
        const input = Object.assign(document.createElement("input"), {
            type: "file",
            onchange: () => {
                videoFile = input.files[0];
                alert("Selected media file : " + input.files[0].name + ". Now, select the JSON file.");
                goToStep2();
            }
        });
        input.click();
    });
    document.getElementById("emptyFile").addEventListener("click", () => {
        alert("Got it. Now, select the JSON file.");
        goToStep2();
    })
    selectJsonBtn.addEventListener("click", () => {
        const input = Object.assign(document.createElement("input"), {
            type: "file",
            onchange: async () => {
                let jsonFile = JSON.parse(await input.files[0].text());
                jsonFile.data.sort((a, b) => a.position - b.position); 
                selectJsonBtn.style.display = "none";
                document.getElementById("progressCard").style.display = "block";
                if (!videoFile) { // Since the user hasn't uploaded a media file, we need to create it. We'll try to fetch the original name of the media from the JSON name, if it seems to follow the syntax used by the extension.
                    let jsonExtension = input.files[0].name.split(".");
                    let mimeType = [
                        input.files[0].name.indexOf("[audio ") !== -1 ? "audio" : "video", // First part of mimetype
                        jsonExtension.length > 1 ? jsonExtension[jsonExtension.length - 2].substring(0, jsonExtension[jsonExtension.length - 2].indexOf(" ")) : "mp4" // Second part of mimetype
                    ];
                    let getStr = jsonExtension.length > 2 ? jsonExtension.slice(0, -2).join(".") : input.files[0].name; // The file name
                    videoFile = new File([], `${getStr}.${mimeType[1]}`, {type: `${mimeType[0]}/${mimeType[1]}`});
                }
                await new Promise(res => {
                    promise.promise = res;
                    navigator.serviceWorker.controller.postMessage({ action: "createFile", id: promise.id, size: jsonFile.length, type: videoFile.type, name: videoFile.name });
                });
                // We need now to start the downloading. We'll do this by either creating an iFrame (the best way, since it bypasses the pop-up restrictions put by many browsers) or by opening a window. The most important part is that the request must be intercepted by the Service Worker.

                /**
                 * Add an iFrame to the page to download the file. 
                * This seems to work only on Safari, since it causes Chrome to crash and Firefox to block the resource. 
                */
                function iFrameFallback() {
                    const iframe = document.createElement("iframe");
                    iframe.src = `./downloadContent?${promise.id}`;
                    iframe.style = "width: 1px; height: 1px; position: fixed; top: -1px; left: -1px;"
                    console.log(iframe);
                    document.body.append(iframe);
                }
                if (!(/^((?!chrome|android).)*safari/i.test(navigator.userAgent))) { // Quick method to detect if Safari is being used. If not, open a pop-up window to download it (since otherwise it would fail).
                    const win = window.open(`./downloadContent?${promise.id}`, "_blank", "width=200,height=200");
                    if (!win) alert("A pop-up window was blocked. Please open it so that the download can start.");
                } else iFrameFallback();

                /**
                 * The position of the element in the `jsonFile` array that is being read
                 */
                let readJsonFile = 0;
                /**
                 * The number of bytes that has been read from the video or the JSON file. 
                 * This means that this value is the same as the number of bytes that have been written to the output file, since the goal of the JSON file is replacing empty bytes of the source file.
                 */
                let bytesRead = 0;
                progress.max = jsonFile.length;
                /**
                 * Copy the bytes from the source video to the output one
                 * @param {number} until the file copy should stop here
                 */
                async function copySource(until) {
                    while (bytesRead < until) {
                        const readTo = Math.min(64000, until - bytesRead);
                        const bytesToSend = await videoFile.slice(bytesRead, bytesRead + readTo).arrayBuffer();
                        await new Promise(res => {
                            promise.promise = res;
                            navigator.serviceWorker.controller.postMessage({ action: "addFile", id: promise.id, data: new Uint8Array(bytesToSend) });
                        })
                        bytesRead += readTo;
                        progress.value += readTo;
                    }
                }
                while (readJsonFile !== jsonFile.data.length) {
                    await copySource(jsonFile.data[readJsonFile].position); // Copy everything from the video file until we get to the position contained in the JSON file
                    // Now, let's replace the content of the video file with the content of the JSON file 
                    let decodedJsonArray = base64ToUint8Array(jsonFile.data[readJsonFile].data);
                    /**
                     * The number of bytes that have been read and copied from the `decodedJsonArray` Uint8Array.
                     */
                    let readJsonArray = 0;
                    while (readJsonArray < decodedJsonArray.byteLength) {
                        const readTo = Math.min(64000, decodedJsonArray.byteLength - readJsonArray);
                        const bytesToSend = decodedJsonArray.slice(readJsonArray, readJsonArray + readTo);
                        await new Promise(res => {
                            promise.promise = res;
                            navigator.serviceWorker.controller.postMessage({ action: "addFile", id: promise.id, data: bytesToSend, });
                        })
                        readJsonArray += readTo;
                        bytesRead += readTo; // These bytes are empty on the source file, since the extension sends also the byte position to the server.
                        progress.value += readTo;
                    }
                    readJsonFile++;
                }
                if (bytesRead < videoFile.size) await copySource(videoFile.size); // Let's copy the end of the media file
                await new Promise(res => {
                    promise.promise = res;
                    navigator.serviceWorker.controller.postMessage({ action: "closeFile", id: promise.id });
                });
                progress.value = progress.max;
                alert("Done! Refresh the webpage to merge another media.");
            }
        })
        input.click();
    });
    /**
    * Convert a base64 string to an Uint8Array
    * @param {string} base64 the base64 of the object to convert (without the data type start)
    * @returns {Uint8Array} an Uint8Array with the decoded input
    */
    function base64ToUint8Array(base64) {
        if (!base64) return;
        let binaryString = atob(base64);
        let length = binaryString.length;
        let bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
})()