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

Go to `about:debugging#/runtime/this-firefox`, and click on the
`Load Temporary Add-on` button. Choose the .zip file, and the extension will be
installed.

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

**Tip: On Chromium-based browsers, you can write files directly to a folder. Use
this option to save memory**

While the download of the videos should automatically start when the page is
closed, or when the video ends playing, it might not always work, so it's
suggested to download them directly from the extension popup.

## Disclaimer

Please use this extension only if you've the authorization from the original
content owner to do so. I don't claim any responsibilties at all for the usage
of this extension and the eventual consequences.
