const electron = require('electron');
const {ipcRenderer} = electron;
document.querySelector('#sel-dir') && document.querySelector('#sel-dir').addEventListener('click', selectDataPath);
let setting
document.querySelector('.save-form') && document.querySelector('.save-form').addEventListener('submit', saveSetting);
document.querySelector('.dropdown-menu').addEventListener(
  'click', function (e) {
    const selectedSite = e.target.innerText
    document.querySelector('.dropdown-toggle').innerText = selectedSite
    const siteSetting = setting[selectedSite]
    document.getElementById('path').value = (siteSetting && siteSetting.path) || document.getElementById('path').value
    document.getElementById('username').value = (siteSetting && siteSetting.username) || ''
    document.getElementById('password').value = (siteSetting && siteSetting.password) || ''
    document.getElementById('name').value = (siteSetting && siteSetting.name) || ''
    document.getElementById('domain').value = (siteSetting && siteSetting.domain) || ''
    document.getElementById('paging-format').value = (siteSetting && siteSetting.pageFormat) || document.getElementById('paging-format').value
    document.getElementById('imgWrapper').value = (siteSetting && siteSetting.imgWrapper) || document.getElementById('imgWrapper').value

  }
)
function saveSetting(e) {
  console.log('Save setting')
  e.preventDefault()
  const data = {
    name: document.getElementById('name').value,
    domain: document.getElementById('domain').value,
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    path: document.getElementById('path').value,
    pageFormat: document.getElementById('paging-format').value,
    imgWrapper: document.getElementById('imgWrapper').value,
  }

  ipcRenderer.invoke('action:saveSetting', data).then(() => {
    console.log('Saved setting')
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
  let siteList = document.querySelector('.dropdown-menu').innerHTML
  let firstSite = ''
  args[1] && Object.keys(args[1]).forEach(site => {
    firstSite = firstSite || site
    siteList += `<li><a class="dropdown-item" href="#">${site}</a></li>`
  })
  siteList += `<li><a class="dropdown-item" href="#">---- New ----</a></li>`
  document.querySelector('.dropdown-menu').innerHTML = siteList
  args[1] && (setting = args[1])
  const siteName = (document.querySelector('.dropdown-toggle').innerText || '').toLowerCase()
  const siteSetting = firstSite && args[1] && args[1][firstSite]
  if (firstSite){
    document.getElementById('site-setting-btn').innerText = firstSite
  }
  console.log('siteName', siteName)
  document.getElementById('path').value = siteSetting ? (siteSetting.path || args[0]) : args[0]
  document.getElementById('username').value = (siteSetting && siteSetting.username) || document.getElementById('username').value
  document.getElementById('password').value = (siteSetting && siteSetting.password) || document.getElementById('password').value
  document.getElementById('name').value = (siteSetting && siteSetting.name) || document.getElementById('name').value
  document.getElementById('domain').value = (siteSetting && siteSetting.domain) || document.getElementById('domain').value
  document.getElementById('imgWrapper').value = (siteSetting && siteSetting.imgWrapper) || document.getElementById('imgWrapper').value
  document.getElementById('paging-format').value = (siteSetting && siteSetting.pageFormat) || document.getElementById('paging-format').value
});
