/**
 * @typedef DataObject
 * All the information necessary to cache a media file.
 * @type {object} 
 * @property {string} mimeType The mimetype of the media source that is being cached.
 * @property {ArrayBuffer[]} data A list of all the chunks that have been cached.
 * @property {string} title The suggested name for the media file.
 * @property {string} id A random identifier of the media that is being cached.
 * @property {boolean | undefined} finalTitle Indicates if the extension is still trying to find a title for the media file or not. If undefined, it means that the extension is still trying to find the name.
 * @property {FileSystemWritableFileStream | undefined} writable If the File System API is being used, this property will contain the WritableStream of the current resource, so that the script can write the chunks directly on the user's drive.
 * @property {number | undefined} currentWrite If the File System API is being used, this property will indicate the position in bytes where the next chunk should be written.
 * @property {FileSystemFileHandle | undefined} file If the File System API is being used, the FileSystemFileHandle object used to get the writable.
 * @property {boolean | undefined} isFromFetch If the server mode has been used to save at least a part of the media file.
 * @property {number | undefined} position If the server mode is being used, it indicates the position of the next chunk, in bytes.
 * @property {ItemsToSend[] | undefined} itemsToSend If the server mode is being used, AND if an error occurred while sending the chunk to the server, this property will contain the array of all the chunks that couldn't be sent.
 * @property {number | undefined} successSend If the server mode is being used, this property indicates the number of chunks that have been successfully sent to the server.
 */

/**
 * @typedef ItemsToSend
 * Information about a chunk that couldn't be sent to the server.
 * @type {object} 
 * @property {number} position the position where the chunk should be written
 * @property {ArrayBuffer} data the cached chunk that should be written
 */