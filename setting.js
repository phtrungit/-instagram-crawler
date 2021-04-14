// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const electron = require('electron');
require('./autocomplete')
const {ipcRenderer} = electron;
document.querySelector('#sel-dir') && document.querySelector('#sel-dir').addEventListener('click', selectDataPath);

document.querySelector('.save-form') && document.querySelector('.save-form').addEventListener('submit', saveSetting);

function saveSetting(e) {
  console.log('Save setting')
  e.preventDefault()

  const data = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    path: document.getElementById('path').value,
  }

  ipcRenderer.invoke('action:saveSetting', data).then(() => {
    document.getElementById('setting-alert').style.display = 'block'
    setTimeout(() => {document.getElementById('setting-alert').style.display = 'none'}, 1000)
  })
}

function selectDataPath(e) {
  e.preventDefault()
  console.log('Click')
  ipcRenderer.invoke('action:selDir')
}

ipcRenderer.on('data:setting', function(e, args){
  console.log('data ', args[0])
  document.getElementById('path').value = args[1] ? (args[1].path || args[0]) : args[0]
  document.getElementById('username').value = (args[1] && args[1].username) || document.getElementById('username').value
  document.getElementById('password').value = (args[1] && args[1].password) || document.getElementById('password').value
});
