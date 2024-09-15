(async () => {
    /**
     * Get the suggested title for the file.
     * NOTE: These are only examples from two popular streaming sites. Before downloading anything from them, ensure you've authorization from the channel owner, and download them only in the cases provided for their Terms of Service.
     * @returns the suggested title for the file
     */
    function getSuggestedTitle() {
        const [title, id] = (() => {
            if (window.location.host.endsWith("youtube.com")) {
                return [document.querySelector("#title > h1 > yt-formatted-string")?.textContent, new URLSearchParams(window.location.search).get("v")]
            } else if (window.location.host.endsWith("twitch.tv")) {
                return [document.querySelector("[data-a-target='stream-title']")?.textContent, ""]
            }
            return [undefined, undefined]
        })()
        if (title && id) return `${title} [${id}]`;
        return document.title;
    }
    let arr = [];
    /**
     * The directory where the files of the current page will be opened
     * @type FileSystemDirectoryHandle
     */
    let picker = undefined;
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
             * Get the suggested title for the item
             * @param id the ID of the item that should be added
             */
            function addTitle(id) {
                const currentItem = arr.find(item => item.id === id);
                if (!currentItem) return;
                currentItem.title = (`${getSuggestedTitle()} [${mimeType.substring(0, mimeType.indexOf("/"))} ${id}].${mimeType.substring(mimeType.indexOf("/") + 1, mimeType.indexOf(";", mimeType.indexOf("/")))}`).replaceAll("<", "‹").replaceAll(">", "›").replaceAll(":", "∶").replaceAll("\"", "″").replaceAll("/", "∕").replaceAll("\\", "∖").replaceAll("|", "¦").replaceAll("?", "¿").replaceAll("*", "");
                document.readyState !== "complete" && setTimeout(() => addTitle(id), 1500); // We'll try again when the page has been loaded
            }
            const id = crypto.randomUUID() ?? `${Math.random()}-${mimeType}-${Date.now()}`;
            arr[arr.length] = { mimeType, data: [], title: document.title, id };
            setTimeout(() => addTitle(id), 1500); // Let's wait a little bit so that the title on the page can be updated
            if (picker !== undefined) {
                picker.getFileHandle(arr.title, { create: true }).then((handle) => {
                    handle.createWritable().then(async (writable) => { // Write the previously-fetched data on the file, and delete it.
                        let position = 0;
                        const currentItem = arr.find(item => item.id === id);
                        while (currentItem.data.length !== 0) {
                            const data = currentItem.data[0];
                            await writable.write({ data, position, type: "write" });
                            position += data.byteLength;
                            currentItem.data.splice(0, 1);
                        }
                        currentItem.currentWrite = position; // Save in the "currentWrite" key the position where further buffers should be written
                        currentItem.writable = writable; // And save the writable in the object, so that future data will be written there
                    })
                })
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
     */
    function singleDownload(id) {
        const currentItem = arr.find(item => item.id === id);
        if (!currentItem || currentItem.writable || currentItem.data.length === 0) return;
        const a = Object.assign(document.createElement("a"), {
            download: currentItem.title,
            href: URL.createObjectURL(new Blob(currentItem.data))
        });
        a.click();
        currentItem.data = [];
    }
    /**
     * Download every ArrayBuffer stored
     */
    function startDownload() {
        for (let i = 0; i < arr.length; i++) {
            singleDownload(arr[i].id);
            arr[i]?.writable?.close();
        }
    }
    document.querySelector("video")?.addEventListener("ended", () => {
        startDownload();
    })
    await start();
    const comms = new BroadcastChannel("CUSTOM_MEDIACACHE_EXTENSION_COMMUNICATION"); // This is replaced every time the extension is built
    window.addEventListener("beforeunload", () => {
        startDownload();
    })
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
                comms.postMessage({ from: "b", action: "getDownloads", context: msg.data.content, content: arr.filter(entry => !entry.writable && entry.data.length > 0) });
                break;
            case "downloadThis": // Download the item in the data.content position
                singleDownload(msg.data.content);
                break;
            case "fileSystem": // Pick a directory
                window.showDirectoryPicker().then((res) => {
                    picker = res;
                });
                break;
            case "deleteThis":
                const getIndex = arr.findIndex(item => item.id === msg.data.content.id);
                if (getIndex === -1) return;
                if (msg.data.content.permanent) arr.splice(getIndex, 1); else arr[getIndex].data = [];
                break;
        }
    };
})()
undefined;