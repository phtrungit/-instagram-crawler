
// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain, Menu, dialog, Notification } = require('electron')
const path = require('path')
const {craw} = require('./intCrawler')
const fs = require('fs');
const dateFns = require('date-fns')
let mainWindow
let settingWindow
let setting
function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 400,

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (!app.isPackaged){
    mainMenuTemplate.push(
      {
        role: 'toggleDevTools'
      },
      {
        role: 'reload'
      })
  }

  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  // Insert menu
  // Menu.setApplicationMenu(mainMenu);
  mainWindow.setMenu(mainMenu)
  // and load the index.html of the app.
  mainWindow.loadFile('./public/index.html')
  mainWindow.on('ready-to-show', function () {
    mainWindow.webContents.send('data:history', [{label: 'phtrungtest', value: 'phtrung'}])
  })
  mainWindow.setMenu(mainMenu)
  mainWindow.on('close', function(){
    mainWindow = null;
    });
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}
const mainMenuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Setting',
        click() {
          createSettingWindow()
          // settingWindow.on(show, function () {
          //   console.log('Show')
          //   settingWindow.webContents.send('data:path', ['Test'])
          // })
        },
        accelerator:process.platform == 'darwin' ? 'Command+S' : 'Ctrl+S',
      },
      {
        role: 'quit'
      }
    ]
  }
]

function createSettingWindow(){

  const pos = mainWindow.getPosition()
  settingWindow = new BrowserWindow({
    width: 800,
    height: 400,
    title:'Add Shopping List Item',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  settingWindow.setMenu(Menu.buildFromTemplate(!app.isPackaged ? [{role: 'toggleDevTools'},
    {
      role: 'reload'
    }] : []))
  settingWindow.setPosition(pos[0] + 150, pos[1] + 50)
  settingWindow.loadFile('./public/setting.html')
  settingWindow.on('ready-to-show', function () {
    settingWindow.webContents.send('data:setting', [`${app.getAppPath()}\\img`, setting])
  })
  // Handle garbage collection
  settingWindow.on('close', function(){
    settingWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try{
    setting = JSON.parse(await fs.readFileSync('./configs/setting.json'))
  }catch (e) {
    setting = {}
  }
  if (!Object.keys(setting).length){
    setting['Instagram'] = {"name":"Instagram","domain":"instagram.com"}
    await fs.writeFileSync('./configs/setting.json', JSON.stringify(setting))
  }
  createWindow()
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
function showNotification (content) {
  const notification = {
    title: 'Instagram crawler',
    body: content
  }
  new Notification(notification).show()
}
ipcMain.handle('action:fetch', async (event, ...args) => {
  console.log('Data from client')
  const startDate = new Date()
  showNotification('Crawling...')
  const insId = args[0]
  const options = args[1]
  saveHistory(insId)
  const siteSetting = setting[options.name] || {}
  // setting = JSON.parse(fs.readFileSync('./configs/history'))
  craw(insId, mainWindow, siteSetting, options).then((data) => {
    mainWindow.webContents.send('data:done', [data])
    showNotification(`Total: ${data} \r\nFinished after ${dateFns.formatDistanceToNowStrict(startDate)}`)
  }).catch((e) => {
    console.log(e)
    mainWindow.webContents.send('data:done', [0])
  })
})

ipcMain.handle('action:selDir', function(event, ...args) {
  dialog.showOpenDialog(settingWindow, {
    properties: ['openDirectory']
  }).then((dir) => {
    settingWindow.webContents.send('data:setting', [dir.filePaths])
  })
});

ipcMain.handle('action:saveSetting', async function(event, ...args) {
  setting[args[0].name] = args[0]
  await fs.writeFileSync('./configs/setting.json', JSON.stringify(setting))
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

function saveHistory(insId){
  const oldHistory = fs.existsSync('./configs/history') &&
    (fs.readFileSync('./configs/history') + '').split(',')
  const newHistory = [...new Set([insId, ...(oldHistory || [])])]
  newHistory.length > 20 && (newHistory.length = 20)

  fs.writeFileSync('./configs/history', newHistory.join(','))
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
