self.addEventListener('install', e => {});
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.url.indexOf("downloadContent") !== -1) {
        const data = requests.get(req.url.substring(req.url.lastIndexOf("?") + 1));
        event.respondWith(new Response(data.stream.readable, {
            headers: {
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(data.name)}`,
                "Content-Type": data.type,
                "Content-Length": data.size
            }
        }))
    } else event.respondWith(fetch(req));  
});

const requests = new Map();
const comms = new BroadcastChannel("comms");

self.addEventListener("message", (msg) => {
    console.log(msg.data);
    switch(msg.data.action) {
        case "createFile": { // Create a new TransformStream to download the file
            const stream = new TransformStream();
            requests.set(msg.data.id, {
                stream, 
                writer: stream.writable.getWriter(),
                size: msg.data.length,
                type: msg.data.type,
                name: msg.data.name
            })
            comms.postMessage(msg.data.id);
            break;
        }
        case "addFile": { // Add the received chunk to the TransformStream writable
            const request = requests.get(msg.data.id);
            request.writer.write(msg.data.data).then(() => {
                comms.postMessage(msg.data.id);
            });
            break;
        }
        case "closeFile": { // Close the writable
            const request = requests.get(msg.data.id);
            request.writer.close();
            comms.postMessage(msg.data.id);
        }
    }
})