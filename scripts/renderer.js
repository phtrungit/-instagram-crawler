const electron = require('electron');
const fs = require('fs')
require('../scripts/autocomplete')
const {ipcRenderer} = electron;

const historyData = (fs.existsSync('./configs/history') && fs.readFileSync('./configs/history'))
console.log((historyData.toString() || '').split(','))
let history = (historyData.toString() || '').split(',')
history && history.length && (history = history.map(hs => {
  return {
    label: hs,
    value: hs
  }
}))

const siteNames = []
const settingData = (fs.existsSync('./configs/setting.json') && fs.readFileSync('./configs/setting.json')) + ''
console.log(settingData)
let setting = (settingData && JSON.parse(settingData))
let siteList = document.querySelector('.dropdown-menu').innerHTML
setting && Object.keys(setting).forEach(site => {
  siteNames.push(site)
  siteList += `<li><a class="dropdown-item" href="#">${site}</a></li>`
})
document.querySelector('.dropdown-menu').innerHTML = siteList
siteNames[0] && (document.querySelector('.dropdown-toggle').innerText = siteNames[0])
document.querySelector('.address-form').addEventListener('submit', submitForm);
document.querySelector('.dropdown-menu').addEventListener(
  'click', function (e) {
    document.querySelector('.dropdown-toggle').innerText = e.target.innerText
    document.querySelector('#inLink').placeholder = e.target.innerText === 'Site' ? 'Ex: https://abc.com' : 'Instagram ID'
    document.getElementById('highResChecked').disabled = true
  }
)

const field = document.getElementById('inLink');
const ac = new Autocomplete(field, {
  data: [],
  maximumItems: 5,
  treshold: 1,
  onSelectItem: ({label, value}) => {
    console.log("user selected:", label, value);
  }
});
console.log('hs ', history)
ac.setData(history)

document.querySelector('#inLink').addEventListener(
  'focusout', function (e) {
    document.getElementsByClassName('autocomplete-wrapper')[0].children.length &&
      setTimeout(() => {
        (document.getElementsByClassName('autocomplete-wrapper')[0].style.display = 'none')
      }, 200)
  }
)

document.querySelector('#inLink').addEventListener(
  'focusin', function (e) {
    document.getElementsByClassName('autocomplete-wrapper')[0].children.length &&
    setTimeout(() => {
      (document.getElementsByClassName('autocomplete-wrapper')[0].style.display = 'inline-block')
    }, 200)
  }
)



function submitForm(e){
  e.preventDefault()
  document.querySelector('.error').innerText = ''
  const insId = document.getElementById('inLink').value
  if (!insId){
    return
  }
  const options = {
    grMemberMin: +document.getElementById('grMemberMin').value || 0,
    grMemberMax: +document.getElementById('grMemberMax').value || 0,
    viz: document.getElementById('vzChecked').checked,
    limit: +document.getElementById('limitImage').value,
    name: document.querySelector('.dropdown-toggle').innerText,
  }
  document.getElementById("progress-bar").style.width = "0"
  document.getElementById("fetchBtn").disabled = true;
  document.querySelector('#fetchBtn').innerHTML =
    `<span id="spinner" 
    class="spinner-border spinner-border-sm" 
    role="status" 
    aria-hidden="true" 
    style="display: inline-block;">
    </span> Fetching...`
  // const item = document.querySelector('#item').value;
  ipcRenderer.invoke('action:fetch', insId, options)

}

ipcRenderer.on('data:done', function(e, args){
  document.getElementById("fetchBtn").disabled = false;
  document.querySelector('#fetchBtn').innerText = 'Fetch'
  if (args[0].errorCode){
    switch (args[0].errorCode) {
      case 1: {
        document.querySelector('.error').innerText = 'Error: Please check your instagram account in File -> Setting'
        break
      }
    }
  }
  if (!args[0]){
    document.querySelector('.error').innerText = 'Error: Unknown error'
  }
  console.log('Total img: ', args[0])
});
ipcRenderer.on('data:status', function(e, args){
  document.querySelector('#progress-bar').innerText = args[0]
  document.getElementById("progress-bar").style.width = args[1]
});
