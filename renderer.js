let selectedFilePath = null;

// Add update status display
const updateStatus = document.createElement('div');
updateStatus.style.position = 'fixed';
updateStatus.style.bottom = '10px';
updateStatus.style.right = '10px';
updateStatus.style.padding = '5px 10px';
updateStatus.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
updateStatus.style.color = 'white';
updateStatus.style.borderRadius = '4px';
updateStatus.style.fontSize = '12px';
document.body.appendChild(updateStatus);

// Listen for update status messages
window.electron.onUpdateStatus((status) => {
  updateStatus.textContent = status;
});

document.getElementById('select-file').addEventListener('click', async () => {
  selectedFilePath = await window.electron.selectMp3();
  document.getElementById('file-path').textContent = selectedFilePath || 'No file selected';
});

document.getElementById('tag-file').addEventListener('click', async () => {
  if (!selectedFilePath) {
    alert('Please select an MP3 file first.');
    return;
  }

  const title = document.getElementById('title').value;
  const artist = document.getElementById('artist').value;
  const year = document.getElementById('year').value;
  const genre = document.getElementById('genre').value;

  console.log('Attempting to tag file:', selectedFilePath);
  console.log('Tags:', { title, artist, year, genre });

  try {
    console.log('Calling tagMp3...');
    const newFilePath = await window.electron.tagMp3(selectedFilePath, { title, artist, year, genre });
    console.log('Tag operation successful:', newFilePath);
    document.getElementById('status').textContent = `Tags updated successfully for: ${newFilePath}`;
    document.getElementById('status').className = 'success';
  } catch (err) {
    console.error('Error during tagging:', err);
    document.getElementById('status').textContent = `Error: ${err}`;
    document.getElementById('status').className = 'error';
  }
});