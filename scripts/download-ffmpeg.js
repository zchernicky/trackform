const fs = require('fs');
const path = require('path');
const axios = require('axios');
const extract = require('extract-zip');
const { exec } = require('child_process');

const FFMPEG_VERSION = '6.1.1';
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');

async function downloadFfmpeg() {
  // Create resources directory if it doesn't exist
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  // Download ffmpeg
  const url = `https://evermeet.cx/ffmpeg/ffmpeg-${FFMPEG_VERSION}.zip`;
  const zipPath = path.join(RESOURCES_DIR, 'ffmpeg.zip');

  console.log('Downloading ffmpeg...');
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer'
  });

  fs.writeFileSync(zipPath, response.data);

  // Extract the zip
  console.log('Extracting ffmpeg...');
  await extract(zipPath, { dir: RESOURCES_DIR });

  // Make ffmpeg executable
  const ffmpegPath = path.join(RESOURCES_DIR, 'ffmpeg');
  fs.chmodSync(ffmpegPath, '755');

  // Clean up zip file
  fs.unlinkSync(zipPath);

  console.log('ffmpeg downloaded and prepared successfully!');
}

downloadFfmpeg().catch(console.error); 