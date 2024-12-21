/**
 * This Node.JS script creates a new file, `ConsoleScript.js`, that can be used for using media-cache directly from the console.
 * ARGUMENTS
 *  - The first argument can be "ui" if a button to download the cached content should be added in the DOM. This button is automatically hidden when fullscreen is activated
 * - The second argument changes the name of the ActionHandler variable
 */

const fs = require("fs");
const text = fs.readFileSync("script.js", "utf-8");
const splittedText = text.split("\n");
splittedText.splice(splittedText.findIndex(item => item.indexOf(`new BroadcastChannel`) !== -1), 1); // Remove any reference to the BroadcastChannel, since we'll comunicate with the script directly with a global value
splittedText.splice(splittedText.findIndex(item => item.indexOf(`if (msg.data.from !== "a") `) !== -1), 1);  // Delete the required sender
splittedText.splice(splittedText.length - 1, 1); // Delete also the last "undefined", since it's useless in the console.
for (const postLine of splittedText.map((entry, i) => { return { entry, i } }).filter(item => item.entry.indexOf(`comms.postMessage(`) !== -1)) splittedText[postLine.i] = postLine.entry.replace("comms.postMessage", "return "); // We'll delete also every reference to the "postMessage", by repacing it with a return (since we're moving this callback to a function)
/**
 * This function creates a button in the top-right part of the screen that permits to download the cached content
 * Note that, in the following script, $ActionHandler is the placeholder for the name of the function name that comunciates with the script
 * Also, note that in the following script I won't try to make something aesthetic.
 */
function addDownloader() {
    const globalStyles = {
        text: "color: #fafafa; font-family: sans-serif;",
        button: `padding: 10px; background-color: #414141; color: #fafafa; font-family: sans-serif; border: 1px solid #fafafa; border-radius: 8px;`
    }
    /**
     * The div that'll contain all the links to download.
     */
    const listContainer = Object.assign(document.createElement("div"), {
        style: "position: fixed; top: 55px; right: 15px; max-width: 45vw; padding: 10px; max-height: 70vh; border-radius: 8px; background-color: #151515; display: none; z-index: 99999999; overflow: scroll"
    });
    /**
     * The button that shows or hides the list
     */
    const downloadSwitch = Object.assign(document.createElement("div"), {
        style: "position: fixed; top: 15px; right: 15px; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background-color: #151515; z-index: 99999999",
        onclick: () => {
            listContainer.innerHTML = "";
            listContainer.style.display = listContainer.style.display === "none" ? "block" : "none";
            if (listContainer.style.display === "none") return;
            // We'll now create the instructions to download the video
            listContainer.append(Object.assign(document.createElement("p"), {
                textContent: "Click on a name to read it as a Blob. Click again to download it (you have five seconds to click it again before it's deleted).",
                style: globalStyles.text
            }), document.createElement("br"));
            for (const item of $ActionHandler({ action: "getDownloads" }).content) {
                /**
                 * The container for the link and the delete button
                 */
                const div = Object.assign(document.createElement("div"), { style: "display: flex; gap: 10px; align-items: center; margin-bottom: 15px" });
                /**
                 * The type of the container of the video/audio
                 */
                const getExtension = item.mimeType.substring(item.mimeType.indexOf("/") + 1, item.mimeType.indexOf(";") === -1 ? undefined : item.mimeType.indexOf(";") === -1);
                /**
                 * The anchor element that'll be used for downloading this item
                 */
                const link = Object.assign(document.createElement("label"), {
                    textContent: `${item.title} [${item.mimeType}]`,
                    style: globalStyles.text
                });
                link.onclick = () => {
                    const newLink = Object.assign(document.createElement("a"), {
                        textContent: `${item.title} [${item.mimeType}]`,
                        download: item.title,
                        style: globalStyles.text,
                        href: URL.createObjectURL(new Blob(item.data))
                    });
                    setTimeout(() => { URL.revokeObjectURL(newLink.href); }, 5000);
                    newLink.click();
                }
                const button = Object.assign(document.createElement("button"), {
                    textContent: "Delete",
                    style: `width: fit-content; ${globalStyles.button}`,
                    onclick: () => {
                        $ActionHandler({ action: "deleteThis", content: { id: item.id } });
                        div.remove();
                    }
                });
                div.append(link, button);
                listContainer.append(div);
            }
            /**
             * This button permits to hide all of the UI for 10 seconds, in case this intereferes with the normal DOM usage
             */
            const hideEverything = Object.assign(document.createElement("button"), {
                style: `width: 100%; ${globalStyles.button}`,
                textContent: "Hide the download UI for 10 seconds",
                onclick: () => {
                    downloadSwitch.style.display = "none";
                    listContainer.style.display = "none";
                    setTimeout(() => {
                        downloadSwitch.style.display = document.fullscreenElement ? "none" : "flex";
                    }, 10000)
                }
            });
            listContainer.append(document.createElement("br"), hideEverything);
        },
        innerHTML: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15.5 16.9997C15.7761 16.9997 16 17.2236 16 17.4997C16 17.7452 15.8231 17.9494 15.5899 17.9917L15.5 17.9997H4.5C4.22386 17.9997 4 17.7759 4 17.4997C4 17.2543 4.17688 17.0501 4.41012 17.0078L4.5 16.9997H15.5ZM10.0001 2.00195C10.2456 2.00195 10.4497 2.17896 10.492 2.41222L10.5 2.5021L10.496 14.296L14.1414 10.6476C14.3148 10.4739 14.5842 10.4544 14.7792 10.5892L14.8485 10.647C15.0222 10.8204 15.0418 11.0898 14.907 11.2848L14.8492 11.3541L10.3574 15.8541C10.285 15.9267 10.1957 15.9724 10.1021 15.9911L9.99608 16.0008C9.83511 16.0008 9.69192 15.9247 9.60051 15.8065L5.14386 11.3547C4.94846 11.1595 4.94823 10.8429 5.14336 10.6475C5.3168 10.4739 5.58621 10.4544 5.78117 10.5892L5.85046 10.647L9.496 14.288L9.5 2.50181C9.50008 2.22567 9.724 2.00195 10.0001 2.00195Z" fill="#fafafa"/>
</svg>`
    });
    downloadSwitch.style.display = document.fullscreenElement ? "none" : "flex";
    document.addEventListener("fullscreenchange", () => { // If there's something in full screen, hide the download button
        downloadSwitch.style.display = document.fullscreenElement ? "none" : "flex";
    });
    document.body.append(listContainer, downloadSwitch);
}
fs.writeFileSync(`ConsoleScript-${process.argv[2] === "ui" ? "UI" : "Console"}.js`, `// If you want to directly execute commands to the script, delete the following line, and the last line of this file.\n(() => {\nlet ${process.argv[3] ?? "ActionHandler"};\n${splittedText.join("\n").replace("comms.onmessage =", "return").replaceAll("msg.data.", "msg.")}.then(val => {${process.argv[3] ?? "ActionHandler"} = val;});\n${process.argv[2] === "ui" ? `(() => {\n${addDownloader.toString().replaceAll("$ActionHandler", process.argv[3] ?? "ActionHandler")}\naddDownloader()})()\n})()` : ""}`);