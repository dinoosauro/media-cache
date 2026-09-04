(async () => {

    /**
     * Includes some flags that can be enabled/disabled either from the code or from the extension UI. These might not always work.
     */
    const CUSTOM_BEHAVIOR = {
        finalize_fs_stream_when_video_finishes: true,
        delete_entries_when_video_finishes: false,
        download_content_when_video_finishes: true,
        server_link: false,
        keep_object_url: false,
        freeze_api: false,
        add_5s_delay_before_download: false,
        send_all_failed_requests_if_one_is_successful: true,
        /**
         * Map a particular mimetype to its extension
         * @type [string, string][]
         */
        mimetype_change: []
    }

    /**
     * Get a random UUID
     * @returns the random UUID
     */
    function getUuid() {
        return crypto.randomUUID() ?? `${Math.random()}-${mimeType}-${Date.now()}`
    }

    /**
     * A map that has as a key the ID of a Promise, and as a value an array containing the resolve function and the reject function.
     * @type Map<string, [() => void, () => void]
     */
    const promisesToWait = new Map();
    /**
     * Get the suggested title for the file.
     * NOTE: These are only examples from two popular streaming sites. Before downloading anything from them, ensure you've authorization from the channel owner, and download them only in the cases provided for their Terms of Service.
     * @returns an array, with [the suggested title for the file, and if the result should be final (true) or not (false). In this last case, it's suggested to check again later for another title]
     */
    function getSuggestedTitle() {
        const [title, id] = (() => {
            if (window.location.host.endsWith("youtube.com")) {
                return [document.querySelector("#title > h1 > yt-formatted-string, .watch-content .slim-video-information-title > .yt-core-attributed-string")?.textContent, new URLSearchParams(window.location.search).get("v")]
            } else if (window.location.host.endsWith("twitch.tv")) {
                return [document.querySelector("[data-a-target='stream-title']")?.textContent, ""]
            }
            return [undefined, undefined]
        })()
        if (title && id) return [`${title} [${id}]`, true];
        return [document.title, !window.location.host.endsWith("youtube.com") && !window.location.host.endsWith("twitch.tv")];
    }
    /**
     * The array that contains all the information about all the cached media
     * @type DataObject[]
     */
    let arr = [];
    /**
    * The directory where the files of the current page will be opened
    * @type FileSystemDirectoryHandle
    */
    let picker = undefined;

    /**
     * Write the already-cached ArrayBuffers to a FileSystemWritable. The writable will be linked with the ID, so that further caching wil be directly done on the FS.
     * @param {string} id the identifier of the resource to write
     * @param {FileSystemWritableFileStream} writable where the binary data should be written
     */
    async function fsWriteOperation(id, writable, handle) {
        let position = 0;
        const currentItem = arr.find(item => item.id === id);
        while (currentItem.data.length !== 0) {
            const data = currentItem.data[0];
            await writable.write({ data, position, type: "write" });
            position += data.byteLength;
            currentItem.data.splice(0, 1);
        }
        currentItem.writable = writable; // And save the writable in the object, so that future data will be written there
        currentItem.currentWrite = position; // Save in the "currentWrite" key the position where further buffers should be written
        currentItem.file = handle; // Add the FileSystemFileHandle in the Object so that it can be moved (if the browser supports so)
    }

    /**
     * Write the chunks added in the `data` property of the provided DataObject by sending them to a server.
     * @param {string | DataObject} id either the ID of the file that is being cached, or the data object.
     * @param {boolean | undefined} fromItemsToSend if the script should try sending again the items that couldn't be sent instead of sending the new items
     * @returns 
     */
    async function fetchWriteOperation(id, fromItemsToSend) {
        /**
         * @type DataObject
         */
        const currentItem = typeof id === "string" ? arr.find(item => item.id === id) : id;
        if (!currentItem.finalTitle) { // Before creating the new file, let's wait that the title is considered final
            await new Promise(res => setTimeout(res, 1000));
            fetchWriteOperation(id, fromItemsToSend);
            return;
        }
        currentItem.isFromFetch = true; // Mark that the fetch operation is being used
        if (typeof currentItem.position === "undefined") currentItem.position = 0; // The position property is essential since it must be sent every time to the server.
        /**
         * 
         * @param {Uint8Array} data the chunk to send to the server
         * @param {number} position the position where the chunk should be written
         * @param {number | undefined} tryNumber the number of failed attempts to send the chunk
         */
        function sendToServer(data, position, tryNumber = 0) {
            const id = getUuid();
            comms.postMessage({ from: "b", action: "uploadBytes", content: { name: currentItem.title, position, buffer: data, id } }); // The bridge script will handle the fetch request to the server.
            if (tryNumber === 0) currentItem.position += data.byteLength; // If it's the first time we're sending this data, it's essential that we update the position property, even if the fetch request fails. With this method, we can keep track of the order of chunks added to the MediaSource.
            const promise = new Promise((res, rej) => promisesToWait.set(id, [res, rej]));
            promise.catch(() => { // Failed to send the request.
                if (tryNumber < 4) { // Let's try again
                    setTimeout(() => {
                        sendToServer(data, position, tryNumber + 1);
                    }, 1000);
                } else { // Let's save the chunk. We'll let the user download it in a JSON file later, so that it can be merged with the other part that was received.
                    if (typeof currentItem.itemsToSend === "undefined") currentItem.itemsToSend = [];
                    currentItem.itemsToSend.push({
                        position,
                        data
                    });
                }
            })
            promise.then(() => { // We'll just increase the `successSend` property, so that the script knows that at least a chunk has been sent to the user, since otherwise we could just download the entire media file without transforming it into a JSON file.
                if (typeof currentItem.successSend === "undefined") currentItem.successSend = 0;
                currentItem.successSend++;
                if ((currentItem.itemsToSend?.length ?? 0) !== 0 && !fromItemsToSend && CUSTOM_BEHAVIOR.send_all_failed_requests_if_one_is_successful) { // Let's try sending the chunks again to the server
                    while (currentItem.itemsToSend.length !== 0) {
                        const item = currentItem.itemsToSend.shift();
                        sendToServer(item.data, item.position);
                    }
                }
            });
        }
        if (fromItemsToSend) {
            while (currentItem.itemsToSend.length !== 0) {
                const itemToSend = currentItem.itemsToSend.shift();
                sendToServer(itemToSend.data, itemToSend.position);
            }
        } else {
            while (currentItem.data.length !== 0) sendToServer(currentItem.data.shift(), currentItem.position)
        }
    }
    /**
     * If a File is being created in the user's file system
     */
    let isFileHandleInCreation = false;
    /**
     * 
     * @param {string} name 
     * @returns the file handle
     */
    async function intelligentFileHandle(name) {
        if (isFileHandleInCreation) {
            await new Promise((res) => setTimeout(res, 50));
            return await intelligentFileHandle(name);
        }
        isFileHandleInCreation = true;
        const file = await picker.getFileHandle(name, { create: true });
        isFileHandleInCreation = false;
        return file;
    }
    /**
     * Edit the MediaSource prototype. Basically, make this script work.
     */
    async function start() {
        const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
        MediaSource.prototype.addSourceBuffer = function (mimeType) { // Keep "function" to inherit the context of the MediaSource
            /**
             * Get the original SourceBuffer
             * @type SourceBuffer
             */
            const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);
            /**
             * If the provided title is final, so no further edits will be made
             */
            let finalTitle = false;
            /**
             * Get the suggested title for the item
             * @param {string} id the ID of the item that should be added
             * @param {number} [timeout=0] make sure this is 0. The script will automatically increase it before stopping looking for changes in the webpage (if it can't find any special filename)
             */
            function addTitle(id, timeout) {
                const currentItem = arr.find(item => item.id === id);
                if (!currentItem) return;
                const [suggestedTitle, result] = getSuggestedTitle();
                // Check if a custom extension should be used for this mimetype
                const suggestedMimetype = mimeType.substring(0, mimeType.indexOf(";")).trim();
                let suggestedExtension = CUSTOM_BEHAVIOR.mimetype_change.find(i => i[0] === suggestedMimetype);
                currentItem.title = (`${suggestedTitle} [${mimeType.substring(0, mimeType.indexOf("/"))} ${id}].${suggestedExtension ? suggestedExtension[1] : mimeType.substring(mimeType.indexOf("/") + 1, mimeType.indexOf(";", mimeType.indexOf("/")))}`).replaceAll("<", "‹").replaceAll(">", "›").replaceAll(":", "∶").replaceAll("\"", "″").replaceAll("/", "∕").replaceAll("\\", "∖").replaceAll("|", "¦").replaceAll("?", "¿").replaceAll("*", "");
                if ((document.readyState !== "complete" || !result) && timeout < 4) {
                    setTimeout(() => addTitle(id, timeout + 1), 1500); // We'll try again when the page has been loaded
                    finalTitle = false;
                } else {
                    finalTitle = true;
                    currentItem.finalTitle = true;
                };
            }
            const id = getUuid();
            arr[arr.length] = { mimeType, data: [], title: document.title, id };
            document.querySelector("video")?.addEventListener("ended", () => {
                startDownload(id);
            }) 
            if (CUSTOM_BEHAVIOR.server_link) fetchWriteOperation(arr[arr.length - 1]); 
            setTimeout(() => addTitle(id, 0), 1500);
            if (picker !== undefined) {
                setTimeout(() => {
                    async function nextStep() {
                        if (!finalTitle) { // We'll wait that the title of the file is final before writing it to the FS.
                            await new Promise((res) => setTimeout(res, 1750));
                            return await nextStep();
                        }
                        intelligentFileHandle(arr.find(entry => entry.id === id).title).then((handle) => {
                            handle.createWritable().then(async (writable) => { // Write the previously-fetched data on the file, and delete it.
                                await fsWriteOperation(id, writable, handle);
                            }).catch((ex) => console.warn(ex));

                        }).catch((ex) => console.warn(ex)); // If it wasn't possible to create the file, we won't do anything.
                    }
                    nextStep();
                }, 1600) // We'll wait 1750ms so that there's a possibility of having the new title.
            }
            const originalAppend = sourceBuffer.appendBuffer;
            sourceBuffer.appendBuffer = function (data) {
                const currentItem = arr.find(item => item.id === id);
                if (currentItem) { // The item hasn't been deleted
                    if (currentItem.writable) { // The File System API is being used
                        currentItem.writable.write({ data, position: currentItem.currentWrite, type: "write" })
                        currentItem.currentWrite += data.byteLength;
                    } else {
                        currentItem.data.push(data);
                        if (currentItem.isFromFetch) fetchWriteOperation(currentItem);
                    }
                }
                const result = originalAppend.call(this, data); // Do the thing that browsers normally do when adding a MediaSource
                return result;
            }
            return sourceBuffer;
        }
    }
    /**
     * Download an ArrayBuffer from the array
     * @param {string} id the ID of the cached content to download
     * @param {boolean | undefined} downloadFromItemsNotSent if the content to download should be fetched from the `itemsToSend.data` property. Note that this won't download the JSON file with the missing chunks, but it'll merge all the missing chunks in a single Blob, and download it.
     */
    async function singleDownload(id, downloadFromItemsNotSent) {
        const currentItem = arr.find(item => item.id === id);
        if (!currentItem || currentItem.writable) return;
        if ((currentItem.data.length !== 0 && !downloadFromItemsNotSent) || (currentItem.itemsToSend?.length ?? 0) !== 0) {
            const blob = new Blob(downloadFromItemsNotSent ? currentItem.itemsToSend.sort((a, b) => a.position - b.position).map(i => i.data) : currentItem.data, {type: "application/octet-stream"});
            if (blob.size !== 0) { // Avoid empty downloads
                const a = Object.assign(document.createElement("a"), {
                    download: currentItem.title,
                    href: URL.createObjectURL(blob)
                });
                if (CUSTOM_BEHAVIOR.add_5s_delay_before_download) await new Promise(res => setTimeout(res, 5000));
                a.click();
                !CUSTOM_BEHAVIOR.keep_object_url && setTimeout(() => {
                    URL.revokeObjectURL(a.href);
                }, 4000);
            }
        }
        currentItem.data = [];
        if (downloadFromItemsNotSent) {
            currentItem.itemsToSend = [];
        } else if (typeof currentItem.itemsToSend !== "undefined") {
            setTimeout(() => {
                downloadMissingJson(currentItem);
            }, 500);
        }
    }
    /**
     * The `startDownload` function contains the code to use when an event happens. It handles most of the `CUSTOM_BEHAVIOR` options.
     * @param {string} id the ID to look
     */
    function startDownload(id) {
        const item = arr.findIndex(i => i.id === id);
        if (item !== -1) {
            CUSTOM_BEHAVIOR.download_content_when_video_finishes && singleDownload(id);
            CUSTOM_BEHAVIOR.finalize_fs_stream_when_video_finishes && arr[item].writable?.close();
            setTimeout(() => {
                CUSTOM_BEHAVIOR.delete_entries_when_video_finishes && arr.splice(item, 1);
            }, 10000) 
        }
        
    }
    await start();
    const comms = new BroadcastChannel("CUSTOM_MEDIACACHE_EXTENSION_COMMUNICATION"); // This is replaced every time the extension is built
    window.addEventListener("beforeunload", () => {
        startDownload();
    })
    /**
     * Download the JSON file with the chunks that haven't been sent to the server
     * @param {DataObject} item the DataObject that contains the `itemsToSend` property to download
     */
    async function downloadMissingJson(item) {
        if ((item.successSend ?? 0) === 0) { // Nothing has been sent to the server. Therefore, it would be useless to create a big JSON file to merge, and so we'll just download the video content.
            singleDownload(item.id, true);
            return;
        }
        if (item.itemsToSend.every(i => (i.data.length ?? i.data.byteLength) === 0)) { // There's no data to send
            item.itemsToSend = [];
            return;
        }
        for (const singleItem of item.itemsToSend) if (typeof singleItem.data !== "string") singleItem.data = _arrayBufferToBase64(singleItem.data); // Transform the ArrayBuffers to a base64 string so that we can save lots of space while downloading the data
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify({
            length: item.position,
            data: item.itemsToSend
        })]));
        a.download = `${item.title} - Missing.json`;
        if (CUSTOM_BEHAVIOR.add_5s_delay_before_download) await new Promise(res => setTimeout(res, 5000));
        a.click();
        item.itemsToSend = [];
        !CUSTOM_BEHAVIOR.keep_object_url && setTimeout(() => {
            URL.revokeObjectURL(a.href);
        }, 4000);
    }
    comms.onmessage = (msg) => {
        if (msg.data.from !== "a") return; // Receive requests only from the isolated content script
        switch (msg.data.action) {
            case "start":
                start();
                break;
            case "stop":
                arr = [];
                break;
            case "getDownloads": // Return the downlaods available
                comms.postMessage({ from: "b", action: "getDownloads", context: msg.data.content, content: arr.filter(entry => (entry.writable || entry.isFromFetch || entry.data.length > 0)).map(({ id, title, mimeType, data, writable, isFromFetch, itemsToSend }) => { return { id, title, mimeType, data: msg.data.everything ? data : undefined, writable: msg.data.everything ? writable : !!writable, isFromFetch, itemsToSend: (itemsToSend?.length ?? 0) !== 0 } }) });
                break;
            case "downloadThis": // Download the item in the data.content position
                singleDownload(msg.data.content);
                break;
            case "fileSystem": {// Pick a directory, and write the previously-cached files there.
                async function apply(res) {
                    picker = res;
                    for (let i = 0; i < arr.length; i++) {
                        const handle = await res.getFileHandle(arr[i].title, { create: true });
                        const writable = await handle.createWritable({ keepExistingData: true });
                        await fsWriteOperation(arr[i].id, writable, handle);
                    }
                }
                msg.data.content ? apply(msg.data.content) : window.showDirectoryPicker({ id: "MediaCachePicker", mode: "readwrite" }).then((res) => apply(res));
                break;
            }
            case "fileSystemSingleOperation": // Write the already-cached chunks to a file handle provided in the request. Used only in the Console Script.
                (async () => {
                    const writable = await msg.data.content.file.createWritable({ keepExistingData: true });
                    await fsWriteOperation(msg.data.content.id, writable, msg.data.content.handle);
                })()
                break;
            case "deleteThis": {
                const getIndex = arr.findIndex(item => item.id === msg.data.content.id);
                if (getIndex === -1) return;
                if (msg.data.content.permanent) arr.splice(getIndex, 1); else {
                    arr[getIndex].data = [];
                    if (arr[getIndex].itemsToSend) arr[getIndex].itemsToSend = [];
                }
                break;
            }
            case "fsFinalize": { // Close the stream in a File System file and delete it from the array list
                const index = arr.findIndex(item => item.id === msg.data.content);
                if (index === -1) return;
                arr[index].writable.close();
                arr.splice(index, 1);
                break;
            }
            case "updateChoices": // Update the CUSTOM_BEHAVIOR settings
                for (const key in msg.data.content) CUSTOM_BEHAVIOR[key] = !!msg.data.content[key];
                if (msg.data.content.mimetype_change) CUSTOM_BEHAVIOR.mimetype_change = msg.data.content.mimetype_change;
                comms.postMessage({ from: "b", action: "getChoices", content: CUSTOM_BEHAVIOR });
                if (CUSTOM_BEHAVIOR.freeze_api) { // Block some of the APIs used by this script from being modified.
                    Object.defineProperty(window, "BroadcastChannel", {
                        value: BroadcastChannel,
                        writable: false,
                        configurable: false
                    });
                    Object.defineProperty(BroadcastChannel.prototype, "postMessage", {
                        value: BroadcastChannel.prototype.postMessage,
                        writable: false,
                        configurable: false
                    });
                    Object.freeze(BroadcastChannel.prototype);
                }
                break;
            case "getChoices": // Return the CUSTOM_BEHAVIOR settings
                comms.postMessage({ from: "b", action: "getChoices", content: CUSTOM_BEHAVIOR });
                break;
            case "resolvePromise": { // Resolve or reject a promise that has been stored in the `promisesToWait` object
                const promise = promisesToWait.get(msg.data.content.id);
                promise && promise[msg.data.content.success ? 0 : 1]();
                break;
            }
            case "downloadMissingJson": { 
                const getIndex = arr.findIndex(item => item.id === msg.data.content.id);
                if (getIndex === -1) return;
                if (arr[getIndex].itemsToSend && arr[getIndex].itemsToSend.length !== 0) {
                    downloadMissingJson(arr[getIndex]);
                }
                break;
            }
            case "trySendAgain": { // Send again all the chunks to the server
                const item = arr.find(i => i.id === msg.data.content.id);
                if (item) fetchWriteOperation(item, true);
                break;
            }
        }
    };
    /**
     * Convert an ArrayBuffer to a base64 string
     * @param {ArrayBuffer} buffer the ArrayBuffer to convert
     * @returns the base64 of the result
     */
    function _arrayBufferToBase64(buffer) {
        let binary = '';
        let bytes = new Uint8Array(buffer);
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
})()
undefined;