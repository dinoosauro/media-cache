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
                    })
                    checkFunctionaly(); // Check again. If everything works, this card will be hidden
                }
            }
        })
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
                textContent: `Content ${item.id} [${item.mimeType}]`,
            }), Object.assign(document.createElement("button"), {
                textContent: "Download",
                onclick: () => {
                    browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "downloadThis", content: item.id });
                }
            }), document.createElement("br"),
                document.createElement("br"),
                Object.assign(document.createElement("label"), {
                    style: "text-decoration: underline; margin-right: 10px;",
                    textContent: "Delete current data",
                    onclick: () => {
                        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "deleteThis", content: { id: item.id, permanent: false } });
                        card.remove();
                    }
                }),
                Object.assign(document.createElement("label"), {
                    textContent: "Delete current and future data",
                    style: "text-decoration: underline",
                    onclick: () => {
                        browserToUse.tabs.sendMessage(+document.getElementById("availableTabs").value, { action: "deleteThis", content: { id: item.id, permanent: true } });
                        card.remove();
                    }
                }));
            document.getElementById("availableDownloads").append(card);
        }

    }
    browserToUse.runtime.onMessage.addListener((msg) => {
        switch (msg.action) {
            case "getDownloads": { // Received an array of the items available to download
                if (!tabResultStorage.get(msg.context.id)) document.getElementById("availableTabs").append(Object.assign(document.createElement("option"), { textContent: msg.context.title, value: msg.context.id }));
                tabResultStorage.set(msg.context.id, msg.content);
                if (document.getElementById("availableTabs").children.length === 1) document.getElementById("availableTabs").dispatchEvent(new Event("change"));
                break;
            }
        }
    });
    /**
    * Get the ID of all the tabs that are being run
    * @type chrome.tabs.Tab[]
    */
    const allTabs = await new Promise((resolve) => browserToUse.tabs.query({}, resolve));
    for (const tab of allTabs) {
        browserToUse.tabs.sendMessage(tab.id, { action: "getDownloads", content: { id: tab.id, title: tab.title } }); // Ask the content script the available downloads
    }
    const allowedUrls = await new Promise((resolve) => browserToUse.storage.sync.get({ urls: [] }, resolve));
    allowedUrls.urls.forEach(origin => addItemToAllowedList(origin)); // Show the added URLs in the UI
    document.getElementById("chooseDirectory").onclick = async () => { // Pick a directory for the File System API
        browserToUse.tabs.sendMessage(ids[0].id, { action: "fileSystem" });
    }
})()