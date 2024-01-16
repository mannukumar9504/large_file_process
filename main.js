const express = require('express');         // Express Web Server
const busboy = require('connect-busboy');   // Middleware to handle the file upload https://github.com/mscdex/connect-busboy
const path = require('path');               // Used for manipulation with path
const fs = require('fs-extra');             // Classic fs

const app = express(); // Initialize the express web server
var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
})); // Insert the busboy middle-ware

const uploadPath = path.join(__dirname, 'fu/'); // Register the upload path
fs.ensureDir(uploadPath); // Make sure that he upload path exits


/**
 * Create route /upload which handles the post request
 */
app.route('/upload').post((req, res, next) => {

    req.pipe(req.busboy); // Pipe it trough busboy

    req.busboy.on('file', (fieldname, file, filename) => {
        console.log(`Upload of '${filename}' started`);

        // Create a write stream of the new file
        const fstream = fs.createWriteStream(path.join(uploadPath, filename));
        // Pipe it trough
        file.pipe(fstream);

        // On finish of the upload
        fstream.on('close', () => {
            console.log(`Upload of '${filename}' finished`);
            res.redirect('back');
        });
    });
});
/**
 * created route to download the file
 */
app.route('/download').post(async (req, res) => {
    const { fileToDownload: fileName } = req.body;
    try {
        //create a readStream of te the exisitig file
        let filepath = path.join(uploadPath, fileName);
        // Check if the file exists
        if (!fs.existsSync(filepath)) {
            res.status(404).send('File not found');
            return;
        }
        // Set headers for the download response
        const fileSize = fs.statSync(filepath).size;
        // Handle range requests for resuming downloads
        const range = req.headers.range;
        console.log("range==>",req.headers)
        res.set({
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileSize,
            'Content-Disposition': `attachment; id="${fileName}"`,
            'Cache-Control': 'public, max-age=31536000'
        });
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            console.log('start: ', start);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            console.log('end: ', end);
            const chunksize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Type': 'application/octet-stream',
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Content-Length': chunksize,
            });
            const file = fs.createReadStream(filepath, { start, end });
            let downloadedBytes = 0;
            file.on('data', function (chunk) {
                downloadedBytes += chunk.length;
                res.write(chunk);
            });
            file.on('end', function () {
                console.log('Download completed');
                res.end();
            });
            file.on('error', function (err) {
                console.log('Error while downloading file:', err);
                res.status(500).send('Error while downloading file');
            });
        } else {
            // Handle full file download requests
            const file = fs.createReadStream(filepath);
            file.pipe(res);
        }
    } catch (error) {
        console.log('error: ', error);
        res.send(500)
    }


})


/**
 * Serve the basic index.html with upload form
 */
app.route('/').get((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<form action="upload" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="fileToUpload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');

    res.write('<form action="download" method="post" enctype="application/json" range="500">');
    res.write('<input type="text" name="fileToDownload"><br>');
    res.write('<button type="submit">Download</button>');
    res.write('</form>');

    return res.end();
});

const server = app.listen(3200, function () {
    console.log(`Listening on port ${server.address().port}`);
});