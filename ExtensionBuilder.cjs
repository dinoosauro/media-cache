const fs = require("fs");
const jszip = require("jszip");
const { sep } = require("path");

const id = crypto.randomUUID().replaceAll("-", "");
function adaptContent(text, isFirefox) {
    text = text.replaceAll("CUSTOM_MEDIACACHE_EXTENSION_COMMUNICATION", id);
    if (isFirefox) text = text.replace(`"service_worker": "background.js"`, `"scripts": ["background.js"]`);
    return text;
}

for (const firefox of [true, false]) {
    const outputZip = new jszip();
    for (const file of ["background.js", "bridge.js", "manifest.json", "script.js", `ui${sep}comms.js`, `ui${sep}style.css`, `ui${sep}ui.html`, `ui${sep}assets${sep}icon-16.png`, `ui${sep}assets${sep}icon-48.png`, `ui${sep}assets${sep}icon-128.png`, `ui${sep}assets${sep}icon.svg`]) outputZip.file(file, adaptContent(fs.readFileSync(file, "utf-8"), firefox));
    outputZip.generateAsync({ type: "nodebuffer" }).then((buffer) => fs.writeFileSync(`Output-${firefox ? "Firefox" : "Chromium"}.zip`, buffer));
}