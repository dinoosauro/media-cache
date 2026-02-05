# media-cache

Cache the video/audio content displayed by various websites, and download it

## Installation:

Download the zip file for your browser from the
[Releases tab](https://github.com/Dinoosauro/media-cache/releases). Then,
depending on your browser:

### Chromium:

Go to the `chrome://extensions` page, and enable the `Developer mode` slider.
Extract the .zip file, and then on your browser click on the
`Load unpacked extension` button. Choose the directory where you've extracted
the .zip file, and the extension will be installed.

### Firefox

Just download it from Mozilla Addons:
https://addons.mozilla.org/it/firefox/addon/media-cache

If you want to sideload it, go to `about:debugging#/runtime/this-firefox`, and
click on the `Load Temporary Add-on` button. Choose the .zip file, and the
extension will be installed.

### Other browsers

There's a script that can be run from the DevTools's console (or other tools
that permit to run JavaScript code in webpages). Look at the
[latest release](https://github.com/Dinoosauro/media-cache/releases), and
copy/paste the:

- `ConsoleScript-UI.js` file if you want to have a button at the top-right
  corner to download the content
- `ConsoleScript-Console.js` file if you want to use the script directly from
  the console. Documentation on the available commands will be added soon.

In case you've chosen the UI, you'll find a button with the download icon at the
top-right. Click it to show the available downloads. To download an item, click
it to load the Blob in the memory, and then click it again (before 5 seconds) if
the download doesn't automatically start. You can also delete the content in
memory if you think it's useless.

## Adding URLs to cache

This extension should work for every website that uses the MediaSource API. To
add a website to cache, click on the extension and write the hostname. Note that
you need to follow a specific syntax to add the URL. For example:

- `*://*.example.com/*`: both for HTTP and HTTPS, cache every video that is
  played from the "example.com" domain
- `https://ex.example.com/*`: cache only videos played from the "ex.example.com"
  domain
- `https://example.com/page`: cache only videos that are played from that
  specific page

## Downloading content

After playing the resource, you can choose from a Select in the popup the page
whose video/audio content you want to download. Click on the "Download" button
to download them.

While the download of the videos should automatically start when the page is
closed, or when the video ends playing, it might not always work, so it's
suggested to download them directly from the extension popup.

### Saving direclty on your device

By default, the extension keeps all the media chunks in memory before downloading them at the end of the stream. This means that the memory usage might be high. However, you can prevent this in two ways:

- On Chromium-based browsers, you can write all the chunks directly to a folder. To do this, open the extension and click on the `Save the currently-cached files on the file system` button;
- If you're using other browsers, or you need to save the media file on another device, you can start a local server that'll save all the chunks direclty on your device. You'll need to provide the server URL in the `Local save` section of the extension UI. To learn how to start the local server, see the [server folder](/server/).


## Disclaimer

Please use this extension only if you've the authorization from the original
content owner to do so. I don't claim any responsibilties at all for the usage
of this extension and the eventual consequences.
