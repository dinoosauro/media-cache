(async () => {
    /**
     * The browser interface to use
     * @type chrome
     */
    const browserToUse = typeof chrome === "undefined" ? browser : chrome;
    const result = await new Promise((res) => browserToUse.storage.sync.get("urls", res));
    /**
     * Convert a wildcard to a regex.
     * _Made by Claude, since I wouldn't be able to write something like this_
     * @param {string} wildcardPattern the pattern
     * @returns a Regex to test
     */
    function wildcardToRegex(wildcardPattern) {
        // Escape special regex characters except * and ?
        const escaped = wildcardPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        // Replace wildcards with regex equivalents
        const converted = escaped
            .replace(/\*/g, '.*')  // * becomes .*
            .replace(/\?/g, '.')   // ? becomes .

        // Ensure the pattern matches the entire string
        return `^${converted}$`;
    }
    /**
     * The Set that contains the ID of the tabs in which the scripts are being injected
     */
    let isTabInjectRunning = new Set();
    /**
     * Check if in the new tab the script should run or not
     * @param {chrome.tabs.Tab} tab the tab to check
     */
    async function eventTabChange(tab) {
        const result = await new Promise((resolve) => browserToUse.storage.sync.get("urls", resolve));
        if (result.urls && result.urls.length > 0) {
            if (result.urls.some(pattern => { // Check that tab URL is allowed from the extension settings
                try {
                    const regex = wildcardToRegex(pattern).replaceAll("\\.", ".");
                    const url = tab.url.trim();
                    return new RegExp(regex).test(url);
                } catch (ex) {
                    return false;
                }
            })) await tabInject(tab);
        }
    }
    browserToUse.tabs.onUpdated.addListener((_, __, tab) => {
        eventTabChange(tab);
    });
    if (result.urls) { // When the extension is being activated, check the URLs that have been previously stored and run the scripts there
        const queryUrl = await new Promise((resolve) => browserToUse.tabs.query({ url: result.urls }, resolve));
        for (const tab of queryUrl) await tabInject(tab)
    }
    /**
     * Inject the content scripts in the tab
     * @param {chrome.tabs.Tab} tab the Tab in which the scripts will be injected
     */
    async function tabInject(tab) {
        if (isTabInjectRunning.has(tab.id)) return;
        isTabInjectRunning.add(tab.id);
        function getPromise() {
            return new Promise((resolve) => {
                browserToUse.tabs.sendMessage(tab.id, { action: "ping" }).catch(async (ex) => { // We'll try to send a ping to the isolated content script. If it isn't received since there isn't a receiving end, we'll add it.
                    if (ex.toString() === "Error: Could not establish connection. Receiving end does not exist.") { // The extension isn't running. Let's add the scripts
                        await browserToUse.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ["bridge.js"]
                        })
                        await browserToUse.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['script.js'],
                            world: "MAIN"
                        });
                        await getPromise(); // Check again
                        resolve();
                    }
                }).then(async (res) => res?.action && resolve());
            });
        }
        await getPromise();
        isTabInjectRunning.delete(tab.id); // The script has been added, so we can delete it from the tab injection
    }
})() 