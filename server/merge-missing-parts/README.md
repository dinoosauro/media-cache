# merge-missing-parts

In case some chunks couldn't be sent to the local server, this directory contains a website that permits to merge the sent chunks with the unsent ones. You'll need to pick first the media file on the server (or, if you don't have it, you can create a blank file directly from the website), and later the JSON file the extension has downloaded on your local device with the missing chunks. 

Try it: https://dinoosauro.github.io/media-cache/server/merge-missing-parts/

Note that the website requires a secure connection, since it relies on Service Workers for the media download process.