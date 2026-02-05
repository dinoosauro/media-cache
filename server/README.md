# Server Setup

In this directory you can find the [server.py](./server.py) Python script that creates a local server used to write directly on the device. 

Note: the File System API continues to be the best option if supported by the browser you're using. 

## Setup

First, make sure you've Python installed on your device. Then, start the script: `python3 server.py *the path of the folder where the files should be saved*`.

The script accepts also some **optional** arguments:

| Argument | Description | Followed by |
| - | - | - |
| `--port` | The port of the local server | A number with an available port (defualt: `1342`) |
| `--address` | The server address that Python should use | A string (default: `localhost`) |

### Exposing the server to the local network

If you want, you can expose the server to your local network, so that you can write all the media files on a single device, even if they are played from different devices. To do that, provide the `--address` argument, followed by your local device IP (ex: `--address 192.168.1.10`). 

**Note:** if you don't use localhost, the browser will probably consider your connection insecure, and therefore might refuse to complete the request. In this case, you need to disable the `mixed content` protection of your browser:
- On Firefox, go to `about:config`, and disable the `security.mixed_content.block_active_content` flag. Make sure to enable it again after you've finished using the local server;
- On Chromium browsers, go to `chrome://settings/content/siteDetails?site=YOUR_SERVER_URL`, and enable the `Insecure content` option.

## API

There's only an endpoint, the `/upload/` one. It must have as query params the `position` int, that indicates the position in bytes where the buffer should be written in the file, and the `filename` string.

Currently, no authentication is required.