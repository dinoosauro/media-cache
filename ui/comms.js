(async () => {
    /**
     * The browser interface to use
     * @type chrome
     */
    const browserToUse = typeof chrome === "undefined" ? browser : chrome;
    /**
     * Get the ID of the current tab
     * @type chrome.tabs.Tab[]
     */
    const ids = await new Promise((resolve) => {
        browserToUse.tabs.query({ active: true }, resolve)
    })

    /**
    * Map a particular mimetype to its extension
    * @type [string, string][]
    */
    let mimetype_change = []
    /**
     * Check that the extension is enabled and is working
     */
    function checkFunctionaly() {
        document.getElementById("notWorking").style.display = "none";
        document.getElementById("chooseDirectory").style.display = typeof window.showDirectoryPicker !== "undefined" ? "block" : "none";
        browserToUse.tabs.sendMessage(ids[0].id, { action: "ping" }).catch((ex) => { // We'll try to send a ping to the isolated content script. If it isn't received since there isn't a receiving end, we'll add it.
            if (ex.toString() === "Error: Could not establish connection. Receiving end does not exist.") { // If the user wants so, they can force running the extension now.
                document.getElementById("notWorking").style.display = "block";
                document.getElementById("chooseDirectory").style.display = "none";
                document.getElementById("forceRun").onclick = async () => {
                    await browserToUse.scripting.executeScript({
                        target: { tabId: ids[0].id },
                        files: ["/bridge.js"]
                    })
                    await browserToUse.scripting.executeScript({
                        target: { tabId: ids[0].id },
                        files: ['/script.js'],
                        world: "MAIN"
                    });
                    browserToUse.tabs.sendMessage(ids[0].id, { // Change what the script should do when the video ends according to the previously-selected things
                        action: "updateChoices",
                        content: await browserToUse.storage.sync.get(["finalize_fs_stream_when_video_finishes", "delete_entries_when_video_finishes", "download_content_when_video_finishes", "server_link", "keep_object_url", "freeze_api", "add_5s_delay_before_download", "send_all_failed_requests_if_one_is_successful", "mimetype_change"])
                    });
                    checkFunctionaly(); // Check again. If everything works, this card will be hidden
                }
            }
        });
    }
    checkFunctionaly();
    document.getElementById("addHostname").addEventListener("click", () => { // Add a new hostname (with the wildcard pattern) in the list of the alllowed URLs
        const origin = document.getElementById("newHostname").value;
        browserToUse.storage.sync.get({ urls: [] }, (data) => {
            const urls = data.urls;
            urls.push(origin);
            browserToUse.storage.sync.set({ urls: urls }, () => {
                alert("Entry added! You might need to refresh the page to make the extension work.");
                addItemToAllowedList(origin);
            });
        });
    })
    /**
     * Show the URL added by the user in a list
     * @param {string} url the URL syntax (with wildcars if added by the user)
     */
    function addItemToAllowedList(url) {
        document.getElementById("allowedList").append(Object.assign(document.createElement("li"), {
            textContent: url,
            onclick: async (e) => {
                const allowedUrls = await new Promise((resolve) => browserToUse.storage.sync.get({ urls: [] }, resolve));
                allowedUrls.urls.splice(allowedUrls.urls.indexOf(url), 1);
                await browserToUse.storage.sync.set({ urls: allowedUrls.urls });
                e.target.remove();
            }
        }));
    }
    /**
     * Show the dialog that tells the user to refresh the list.
     */
    function showRefreshDialog() {
        document.getElementById("refreshContainer").style.display = "block";
        setTimeout(() => {
            document.getElementById("refreshContainer").style.opacity = "1";
        });
    }
    /**
     * A Map that contains all the available downloads from the various content script that are being run
     */
    const tabResultStorage = new Map();
    document.getElementById("availableTabs").onchange = () => { // The user has changed the selected items in the tab
        document.getElementById("availableDownloads").innerHTML = "";
        for (const item of tabResultStorage.get(+document.getElementById("availableTabs").value)) { // Create a Card with all of the downloadable items of that folder
            const card = document.createElement("div");
            card.classList.add("card");
            card.style.backgroundColor = "var(--cardsecond)";
            card.style.marginBottom = "15px";
            card.append(Object.assign(document.createElement("h3"), {
                textContent: `${item.title} [ID: ${item.id}] [Mimetype: ${item.mimeType}]`,
            }));
            !item.isFromFetch ? card.append(Object.assign(document.createElement("button"), {
                textContent: item.writable ? "Finalize stream" : "Download",
                onclick: () => {
                    browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: item.writable ? "fsFinalize" : "downloadThis", content: item.id });
                }
            })) : card.append(Object.assign(document.createElement("label"), {
                textContent: "Sent to local server"
            }));
            item.itemsToSend && card.append(document.createElement("br"), document.createElement("br"), Object.assign(document.createElement("label"), {
                textContent: "Some data couldn't be sent to the server. You can download a JSON file with all the information necessary to build the output file, or you can remove everything from memory. "
            }), Object.assign(document.createElement("label"), {
                className: "underline hover",
                textContent: "Download missing data",
                style: "margin-right: 10px",
                onclick: () => {
                    browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "downloadMissingJson", content: { id: item.id } });
                    showRefreshDialog();
                }
            }), Object.assign(document.createElement("label"), {
                className: "underline hover",
                textContent: "Try sending again",
                onclick: () => {
                    browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "trySendAgain", content: { id: item.id } });
                    showRefreshDialog();
                }
            }))
            !item.writable && (!item.isFromFetch || item.itemsToSend) && card.append(document.createElement("br"),
                document.createElement("br"),
                Object.assign(document.createElement("label"), {
                    className: "underline hover",
                    style: "margin-right: 10px;",
                    textContent: "Delete current data",
                    onclick: () => {
                        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "deleteThis", content: { id: item.id, permanent: false } });
                        showRefreshDialog();
                    }
                }),
                Object.assign(document.createElement("label"), {
                    textContent: "Delete current and future data",
                    className: "underline hover",
                    onclick: () => {
                        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "deleteThis", content: { id: item.id, permanent: true } });
                        card.remove();
                    }
                }));
            document.getElementById("availableDownloads").append(card);
        }
        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "getChoices" });
    }
    browserToUse.runtime.onMessage.addListener((msg) => {
        switch (msg.action) {
            case "getDownloads": { // Received an array of the items available to download
                if (!tabResultStorage.get(msg.context.id)) document.getElementById("availableTabs").append(Object.assign(document.createElement("option"), { textContent: msg.context.title, value: msg.context.id }));
                tabResultStorage.set(msg.context.id, msg.content);
                if (document.getElementById("availableTabs").children.length === 1) document.getElementById("availableTabs").dispatchEvent(new Event("change"));
                break;
            }
            case "getChoices": { // Update the "After downloading, do this..." choices
                for (const choice in msg.content) {
                    const item = document.querySelector(`[data-updatechoice='${choice}']`);
                    if (item) item[item.type === "checkbox" ? "checked" : "value"] = msg.content[choice];
                    if (choice === "mimetype_change") {
                        mimetype_change = msg.content[choice];
                        document.getElementById("addedMaps").innerHTML = "";
                        for (const element of mimetype_change) buildMimetypeChangeList(element[0], element[1]);
                    }
                }
            }
        }
    });

    document.getElementById("addExtensionMap").addEventListener("click", () => { // Map a mimetype to a new extension
        const [mimetype, extension] = [document.getElementById("extensionMimetype").value, document.getElementById("extensionToSet").value];
        const index = mimetype_change.findIndex(i => i[0] === mimetype);
        if (index !== -1) { // Delete the previous entry for the same mimetype
            mimetype_change.splice(index, 1);
            document.getElementById("addedMaps").children.item(index).remove();
        }
        mimetype_change.push([mimetype, extension]);
        buildMimetypeChangeList(mimetype, extension);
        updateMimetypeList();
    })

    /**
     * Add an elemento to the custom mimetype extension list
     * @param {string} mimetype the mimetype the extension is tied to
     * @param {string} extension the extension the mimetype is tied to
     */
    function buildMimetypeChangeList(mimetype, extension) {
        const li = Object.assign(document.createElement("li"), {
            textContent: `${mimetype}: ${extension}`,
            onclick: () => {
                const index = mimetype_change.findIndex(i => i[0] === mimetype);
                if (index !== -1) {
                    mimetype_change.splice(index, 1);
                    li.remove();
                    updateMimetypeList();
                }
            }
        });
        document.getElementById("addedMaps").append(li);
    }
    // Get the already-added mimetypes
    const currentElementsInMimetype = await new Promise((resolve) => browserToUse.storage.sync.get({ mimetype_change: [] }, resolve));
    mimetype_change = currentElementsInMimetype.mimetype_change;
    mimetype_change.forEach(i => buildMimetypeChangeList(i[0], i[1]));
    /**
     * Store the updated custom mimetypes extension and send them to the application
     */
    function updateMimetypeList() {
        browserToUse.storage.sync.set({ mimetype_change });
        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, {
            action: "updateChoices",
            content: { mimetype_change }
        });
    }
    /**
     * Get the information about the content cached in the tabs
     */
    async function getContentInTabs() {
        /**
        * Get the ID of all the tabs that are being run
        * @type chrome.tabs.Tab[]
        */
        const allTabs = await new Promise((resolve) => browserToUse.tabs.query({}, resolve));
        for (const tab of allTabs) {
            browserToUse.tabs.sendMessage(tab.id, { action: "getDownloads", content: { id: tab.id, title: tab.title } }); // Ask the content script the available downloads
        }
    }
    await getContentInTabs();

    document.getElementById("forceRefresh").addEventListener("click", async () => { // Make the refresh button work
        await getContentInTabs();
        document.getElementById("refreshContainer").style.opacity = "0";
        setTimeout(() => {
            document.getElementById("refreshContainer").style.display = "none";
        }, 210);
    });
    const allowedUrls = await new Promise((resolve) => browserToUse.storage.sync.get({ urls: [] }, resolve));
    allowedUrls.urls.forEach(origin => addItemToAllowedList(origin)); // Show the added URLs in the UI
    document.getElementById("chooseDirectory").onclick = async () => { // Pick a directory for the File System API
        browserToUse.tabs.sendMessage(ids[0].id, { action: "fileSystem" });
    }


    for (const checkbox of document.querySelectorAll("[data-updatechoice]")) { // Permit to change the behavior of the script after the video has ended
        checkbox.addEventListener(checkbox.type === "checkbox" ? "change" : "input", () => {
            const [checked, property] = [checkbox.type === "checkbox" ? checkbox.checked : checkbox.value, checkbox.getAttribute("data-updatechoice")];
            browserToUse.storage.sync.set({ [property]: checked });
            browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, {
                action: "updateChoices",
                content: { [property]: checked }
            });
        });
    }
    browserToUse.tabs.sendMessage(ids[0].id, { action: "getChoices" }); // Ask the current choices to the script.

    document.getElementById("version").textContent = browserToUse.runtime.getManifest().version;
})()