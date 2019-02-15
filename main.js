//import { Packager } from 'electron-builder/out/packager';

const {
    app,
    BrowserWindow,
    ipcMain,
    Menu
} = require('electron')
const path = require('path')
const url = require('url')
const striptags = require('striptags')
const Store = require('electron-store');
const moment = require('moment');
const csv = require('csvtojson');
const store = new Store();

module.paths.push(path.resolve('node_modules'));
module.paths.push(path.resolve('../node_modules'));
module.paths.push(path.resolve(__dirname, '..', '..', '..', '..', 'resources', 'app', 'node_modules'));
module.paths.push(path.resolve(__dirname, '..', '..', '..', '..', 'resources', 'app.asar', 'node_modules'));

var request = require('request');
var fs = require('fs');
var async = require("async");


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let setupDialog
let ndaSelectDialog
let changeLabelDialog
let getDateStringDialog
let getImportAliasDialog
let getDeleteEventDialog
let tagstore
let datadicationary
let instrumentLabels
let token
let current_event
let current_form
let dataMode
let dataModeFilesystemData = []
let current_url = 'https://abcd-rc.ucsd.edu/redcap/api/';
let current_subject_json = ''; // the name of an additional file that contains subject information (pGUID, 'gender')
let current_subject_json_data = [] // the content of an additional file that contains subject information (pGUID, 'gender', 'dob', 'interview_age...')
let instrumentEventMapping = {};
let restrictToNDA = ''
let restrictToNDADD = []
let removeAnyText = false
let anyErrorDownloading = {
    'errors': [],
    'numOk': 0,
    'numBad': 0
}

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1100,
        height: 700,
        "webPreferences": {
            devTools: true
        }
    });

    // a read only version of the tags at the beginning of the program (speed up tag lockup)
    tagstore = store.store;

    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    var template = [{
        label: "Application",
        submenu: [{
                label: "About Application",
                selector: "orderFrontStandardAboutPanel:"
            },
            {
                type: "separator"
            },
            {
                label: "Quit",
                accelerator: "Command+Q",
                click: function () {
                    app.quit();
                }
            }
        ]
    }, {
        label: "Edit",
        submenu: [{
                label: "Undo",
                accelerator: "CmdOrCtrl+Z",
                selector: "undo:"
            },
            {
                label: "Redo",
                accelerator: "Shift+CmdOrCtrl+Z",
                selector: "redo:"
            },
            {
                type: "separator"
            },
            {
                label: "Cut",
                accelerator: "CmdOrCtrl+X",
                selector: "cut:"
            },
            {
                label: "Copy",
                accelerator: "CmdOrCtrl+C",
                selector: "copy:"
            },
            {
                label: "Paste",
                accelerator: "CmdOrCtrl+V",
                selector: "paste:"
            },
            {
                label: "Select All",
                accelerator: "CmdOrCtrl+A",
                selector: "selectAll:"
            }
        ]
    }];

    //Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    // Open the DevTools.
    //win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })

    // show some information about the program location for the local file:
    console.log("store location for local file: " + app.getPath('userData'));
    win.send('info', "store location for local file: " + app.getPath('userData'));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can alsdo put them in separate files and require them here.


ipcMain.on('openNDASelectDialog', function (event, arg) {
    console.log("start openNDASelectDialog...");
    if (ndaSelectDialog) {
        ndaSelectDialog.show();
        return;
    }
    ndaSelectDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 730,
        height: 410
    });
    ndaSelectDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'ndaSelectDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    ndaSelectDialog.once('ready-to-show', function () {
        ndaSelectDialog.show();
    });
    console.log("done with openNDASelectDialog...");
    ndaSelectDialog.on('closed', function () {
        console.log("ndaSelectDialog was closed");
    });
});

ipcMain.on('closeNDASelectDialogOk', function (event, arg) {
    //console.log("got to set a new Value as :" + arg['shortName']);
    restrictToNDA = arg['shortName'];
    // indicate in the interface that there is a value for this now
    win.send('ndaSelectButtonTextChange', {
        'shortName': arg['shortName']
    });

    // get the data dictionary for this short name
    restrictToNDADD = [];
    // curl -X GET --header 'Accept: application/json' 'https://ndar.nih.gov/api/datadictionary/v2/datastructure/abcd_psb01'
    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }
    if (restrictToNDA.length > 0) {
        var url = 'https://ndar.nih.gov/api/datadictionary/v2/datastructure/' + restrictToNDA;
        request({
            method: 'GET',
            url: url,
            form: [],
            headers: headers,
            json: true
        }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                // error case
                //process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
                win.send('alert', JSON.stringify({
                    response: response,
                    error: error,
                    body: body
                }));
                writeLog("error requesting datastructure from NDA for \"" + restrictToNDA + "\" not found? See: " + error + ", " + body );
                return;
            }
            //console.log(JSON.stringify(body));
            win.send('message', "read data dictionary for " + restrictToNDA + " from NDA...");
            writeLog("read data dictionary for " + restrictToNDA + " from NDA...");
            restrictToNDADD = body;
        });
    }

    if (ndaSelectDialog)
        ndaSelectDialog.hide();
});
ipcMain.on('closeNDASelectDialogCancel', function (event, arg) {
    if (ndaSelectDialog)
        ndaSelectDialog.hide();
});
ipcMain.on('setDataMode', function(event, arg) {
    // set the data mode (either REDCap or filesystem)
    dataMode = arg['mode'];
});

ipcMain.on('closeNDASelectDialogVerify', function (event, arg) {
    //console.log("got to set a new Value as :" + arg['shortName']);
    // restrictToNDA = arg['shortName'];
    // indicate in the interface that there is a value for this now
    //win.send('ndaSelectButtonTextChange', {
    //    'shortName': arg['shortName']
    //});

    // get the data dictionary for this short name
    // restrictToNDADD = [];
    // curl -X GET --header 'Accept: application/json' 'https://ndar.nih.gov/api/datadictionary/v2/datastructure/abcd_psb01'
    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }
    var url = 'https://ndar.nih.gov/api/datadictionary/v2/datastructure/' + arg['shortName'];
    request({
        method: 'GET',
        url: url,
        form: [],
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            //process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            win.send('alert', JSON.stringify({
                response: response,
                error: error,
                body: body
            }));
            callback("error");
            return;
        }
        //console.log(JSON.stringify(body));
        win.send('message', "read data dictionary for " + restrictToNDA + " from NDA...");
        writeLog("read data dictionary for " + restrictToNDA + " from NDA...");
        // now check against the selected instrument to verify 
        var txt = verify(current_form, body);
        writeLog("Verification: \n" + txt);

        // restrictToNDADD = body;
    });

    if (ndaSelectDialog)
        ndaSelectDialog.hide();
});


ipcMain.on('ndaDDFromREDCap', function (event, arg) {
    writeLog("ask NDA for the list of data dictionaries...");
    // curl -X GET --header 'Accept: application/json' 'https://ndar.nih.gov/api/datadictionary/v2/datastructure'
    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }
    var url = 'https://ndar.nih.gov/api/datadictionary/v2/datastructure';
    request({
        method: 'GET',
        url: url,
        form: [],
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            //process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            win.send('alert', JSON.stringify({
                response: response,
                error: error,
                body: body
            }));
            callback("error");
            return;
        }
        //console.log(JSON.stringify(body));
        win.send('message', "read information from NDA...");
        data = [];
        // only add data that will be exported
        for (var i = 0; i < body.length; i++) {
            if (body[i]['status'] !== 'Published') {
                win.send('message', 'this instrument is not published yet: ' + JSON.stringify(body[i]) + '. Only published instruments will be available');
                continue;
            }
            if (typeof body[i]['sources'] !== 'undefined' && body[i]['sources'].indexOf('ABCD Release 2.0') >= 0) {
                data.push(body[i]);
            }
        }
        ndaDD = data;

        // call ndaSelectDialog again with the results
        ndaSelectDialog.send('ndaDDFromREDCap', data);
    });
});

ipcMain.on('parseFilesystemData', function (event, arg) {
    // user selected no database, instead all information comes from a directory with CSV files
    // start fresh
    dataModeFilesystemData = [];
    var instruments = [];
    datadictionary = [];
    for (var j = 0; j < arg['dirname'].length; j++) {  // array of directories
        var dataModeFilesystemDir = arg['dirname'][j]; // inside each look for csv files
        var files = fs.readdirSync(dataModeFilesystemDir).filter(fn => fn.endsWith('.csv'));
        for (var i = 0; i < files.length; i++) {
            if (fs.existsSync(dataModeFilesystemDir + path.sep + files[i])) {
                // lets add the entry to the interface as well
                var instrumentName = path.basename(dataModeFilesystemDir + path.sep + files[i], '.csv'); 
                instruments.push([instrumentName, instrumentName]);

                var sj = [];
                try { // read them asynchronously
                    (function(filename, instrumentName) {
                        sj = csv().fromFile(dataModeFilesystemDir + path.sep + filename).then(function (data) {
                            console.log("read data from csv: " + dataModeFilesystemDir + path.sep + filename);
                            if (data.length > 0) {
                                var keys = Object.keys(data[0]);
                                // add this to the data dictionary
                                for (var k = 0; k < keys.length; k++) { // create a fake data dictionary entry
                                    datadictionary.push({ 
                                        'field_name': keys[k], 
                                        'form_name': instrumentName,
                                        'field_type': 'text',
                                        'field_label': 'unknown',
                                        'select_choices_or_calculations': '',
                                        'branching_logic': '',
                                        'field_annotation': '',
                                        'aliases': '',
                                        'text_validation_type_or_show_slider_number': ''
                                    });
                                }
                                console.log("file " + filename + " has " + keys.length + " columns and " + data.length + " rows.");
                                dataModeFilesystemData[filename] = data; // store for later (can be very large!!!, ignore for now)
                            } else {
                                console.log("Error: no rows found in " + dataModeFilesystemDir + path.sep + filename + ", ignore this file.");
                            }
                        });
                    })(files[i], instrumentName);
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        writeLog(e);
                    } else {
                        writeLog(e, false);
                    }
                }
            }
        }
    }
    win.send('updateInstrumentList', instruments);
});

ipcMain.on('openSetupDialog', function (event, arg) {
    console.log("start openSetupDialog...");
    if (setupDialog) {
        setupDialog.show();
        return;
    }
    setupDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 480,
        height: 560
    });
    setupDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'setupDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    setupDialog.once('ready-to-show', function () {
        setupDialog.show();
    });
    console.log("done with openSetupDialog...");
    setupDialog.on('closed', function () {
        console.log("setupDialog was closed");
    });

});

ipcMain.on('closeSetupDialogCancel', function (event, arg) {
    if (setupDialog) {
        setupDialog.hide();
        console.log("closed setup DIALOG after cancel");
    }
});
ipcMain.on('closeSetupDialogOk', function (event, arg) {
    if (setupDialog) {
        setupDialog.hide();
        token = arg.token;
        current_event = arg.event;
        current_url = arg.url;
        // the current_subject_json has already been set by the callback from the open dialog
        //current_subject_json = arg.subject_json;
        console.log("closed setup DIALOG after ok: " + token + " " + event + " " + current_url); // + " " + current_subject_json);

        // now populate the list with the instruments
        updateInstrumentList(current_event);
    }
});
ipcMain.on('closeSetupDialogFilesystemOk', function (event, arg) {
    if (setupDialog) {
        setupDialog.hide();
        //token = arg.token;
        current_event = arg.event;
        // current_url = arg.url;
        // the current_subject_json has already been set by the callback from the open dialog
        //current_subject_json = arg.subject_json;
        console.log("closed setup DIALOG after ok for filesystem type input: " + event + " "); // + " " + current_subject_json);

        // now populate the list with the instruments (should hopefully look at dataMode)
        updateInstrumentList(current_event);
    }
});



ipcMain.on('setupRemoveAnyText', function (event, arg) {
    if (arg['value']) {
        removeAnyText = true;
    } else {
        removeAnyText = false;
    }
});

ipcMain.on('openGetDateStringDialog', function (event, arg) {
    console.log("start openGetDateStringDialog... with argument: " + JSON.stringify(arg));
    var item = arg['item'];
    if (getDateStringDialog) {
        getDateStringDialog.show();
        var parse = store.get('parse-' + item);
        console.log("get value from store for " + 'parse-' + item + " IS: " + parse);
        getDateStringDialog.send('changeParse', {
            parse: parse,
            item: arg['item']
        });
        return;
    }
    getDateStringDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 460,
        height: 350
    });
    getDateStringDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'getDateStringDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    getDateStringDialog.once('ready-to-show', function () {
        getDateStringDialog.show();
        var parse = store.get('parse-' + arg['item']);
        getDateStringDialog.send('changeParse', {
            parse: parse,
            item: arg['item']
        });
    });
    console.log("done with getDateStringDialog...");
    getDateStringDialog.on('closed', function () {
        console.log("getDateStringDialog was closed");
    });
});

ipcMain.on('closeGetDateStringDialogCancel', function (event, arg) {
    if (getDateStringDialog) {
        getDateStringDialog.hide();
        console.log("closed setup DIALOG after cancel");
    }
});

ipcMain.on('closeGetDateStringDialogOk', function (event, arg) {
    if (getDateStringDialog) {
        getDateStringDialog.hide();
        parse = arg.parse;
        item = arg.item;
        console.log("closed setup DIALOG after ok: " + parse + " " + item + " save now: " + 'parse-' + item + " with value: " + parse);
        // we need to store the parse now
        store.set('parse-' + item, [parse]);
    }
});

/////////////////////////////////////////////////////////////////////


ipcMain.on('openGetImportAliasDialog', function (event, arg) {
    console.log("start openImportAliasDialog... with argument: " + JSON.stringify(arg));
    var item = arg['item'];
    if (getImportAliasDialog) {
        getImportAliasDialog.show();
        var alias = store.get('alias-' + item);
        if (Array.isArray(alias)) {
            alias = alias.join(" "); // convert to string
        }
        console.log("get value from store for " + 'alias-' + item + " IS: " + alias);
        getImportAliasDialog.send('changeAlias', {
            alias: alias,
            item: arg['item']
        });
        return;
    }
    getImportAliasDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 460,
        height: 350
    });
    getImportAliasDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'getImportAliasDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    getImportAliasDialog.once('ready-to-show', function () {
        getImportAliasDialog.show();
        var alias = store.get('alias-' + arg['item']);
        if (Array.isArray(alias)) {
            alias = alias.join(' ');
        }
        getImportAliasDialog.send('changeAlias', {
            alias: alias,
            item: arg['item']
        });
    });
    console.log("done with getImportAliasDialog...");
    getImportAliasDialog.on('closed', function () {
        console.log("getImportAliasDialog was closed");
    });
});

ipcMain.on('closeGetImportAliasDialogCancel', function (event, arg) {
    if (getImportAliasDialog) {
        getImportAliasDialog.hide();
        console.log("closed import alias DIALOG after cancel");
    }
});

ipcMain.on('closeGetImportAliasDialogOk', function (event, arg) {
    if (getImportAliasDialog) {
        getImportAliasDialog.hide();
        // we are getting a string back here...
        alias = arg.alias;
        item = arg.item;
        console.log("closed import alias DIALOG after ok: " + alias + " " + item + " save now: " + 'parse-' + item + " with value: " + alias);
        // we need to store the parse now
        store.set('alias-' + item, alias.split(" "));
    }
});



/////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////////////////


ipcMain.on('openDeleteEventDialog', function (event, arg) {
    console.log("start openDeleteEventDialog... with argument: " + JSON.stringify(arg));
    var item = arg['item'];
    if (getDeleteEventDialog) {
        getDeleteEventDialog.show();
        var dele = store.get('remove-' + item);
        if (Array.isArray(dele)) {
            dele = alias.join(" "); // convert to string
        }
        console.log("get value from store for " + 'remove-' + item + " IS: " + dele);
        getDeleteEventDialog.send('changeDelete', {
            delete: dele,
            item: arg['item']
        });
        return;
    }
    getDeleteEventDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 460,
        height: 450
    });
    getDeleteEventDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'getDeleteEventDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    getDeleteEventDialog.once('ready-to-show', function () {
        getDeleteEventDialog.show();
        // update the list of events in the interface
        getDeleteEventDialog.send('getDeleteEventEventList', { item: item, events: allEvents.map(function(a) { return a['unique_event_name']; }) } );
    });
    console.log("done with getDeleteEventDialog...");
    getDeleteEventDialog.on('closed', function () {
        console.log("getDeleteEventDialog was closed");
    });
});

ipcMain.on('updateDeleteEventCheckboxes', function(event, data) {
    var dele = store.get('remove-' + data['item']);
    if (Array.isArray(dele)) {
        dele = dele.join(' ');
    }
    // this is too early, we don't have the dialog yet and the checkboxes don't exist yet
    getDeleteEventDialog.send('changeDelete', {
        delete: dele,
        item: data['item']
    });
});

ipcMain.on('closeGetDeleteEventDialogCancel', function (event, arg) {
    if (getDeleteEventDialog) {
        getDeleteEventDialog.hide();
        console.log("closed delete event DIALOG after cancel");
    }
});

ipcMain.on('closeGetDeleteEventDialogOk', function (event, arg) {
    if (getDeleteEventDialog) {
        getDeleteEventDialog.hide();
        // we are getting a string back here...
        dele = arg.delete;
        item = arg.item;
        console.log("closed delete event DIALOG after ok: " + JSON.stringify(dele) + " item: " + item + " save now: " + 'remove-' + item + " with value: " + JSON.stringify(dele));
        // we need to store the parse now
        store.set('remove-' + item, dele.join(" "));
    }
});



/////////////////////////////////////////////////////////////////////





ipcMain.on('openChangeLabelDialog', function (event, arg) {
    console.log("start openChangeLabelDialog... with argument: " + JSON.stringify(arg));
    if (changeLabelDialog) {
        changeLabelDialog.show();
        changeLabelDialog.send('changeLabelCurrentName', {
            name: arg['name'],
            instrument: arg['instrument'],
            nda_name: arg['nda_name'],
            version: arg['version'],
            guard_name: arg['guard_name']
        });
        return;
    }
    changeLabelDialog = new BrowserWindow({
        parent: win,
        modal: true,
        show: false,
        titleBarStyle: 'hidden',
        frame: false,
        useContentSize: true,
        width: 460,
        height: 600
    });
    changeLabelDialog.loadURL(url.format({
        pathname: path.join(__dirname, 'changeLabelDialog.html'),
        protocol: 'file:',
        slashes: true
    }));
    changeLabelDialog.once('ready-to-show', function () {
        changeLabelDialog.show();
        changeLabelDialog.send('changeLabelCurrentName', {
            name: arg['name'],
            instrument: arg['instrument'],
            nda_name: arg['nda_name'],
            version: arg['version'],
            guard_name: arg['guard_name']
        });
    });
    console.log("done with openChangeLabelDialog...");
    changeLabelDialog.on('closed', function () {
        console.log("openChangeLabelDialog was closed");
    });
    // win.send('changeLabelCurrentName', arg);
    //setTimeout(function() { jQuery('#change-label-dialog-name').val( jQuery(this).text() ); }, 200);

});

ipcMain.on('closeChangeLabelDialogReset', function (event, arg) {
    if (changeLabelDialog) {
        changeLabelDialog.hide();
        var name = arg.name.trim();
        var instrument = arg.instrument;
        var version = arg.version;
        var nda_name = arg.nda_name;
        // var guard_name = arg.guard_name;

        console.log("closed setup DIALOG after reset");
        // what is the default value?
        name = instrumentLabels[instrument];

        // here we should delete the tag instead of setting it to the default
        results = [{
            'tags': [name, version, nda_name],
            'item': instrument,
            'prefix': 'instrument-',
            'additional-action': 'delete'
        }];
        win.send('updateTagValues', results);
    }
});

ipcMain.on('closeChangeLabelDialogCancel', function (event, arg) {
    if (changeLabelDialog) {
        changeLabelDialog.hide();
        console.log("closed setup DIALOG after cancel");
    }
});

ipcMain.on('closeChangeLabelDialogOk', function (event, arg) {
    if (changeLabelDialog) {
        changeLabelDialog.hide();
        name = arg.name.trim();
        instrument = arg.instrument;
        version = arg.version.trim();
        nda_name = arg.nda_name.trim();
        guard_name = arg.guard_name.trim();
        console.log("closed setup DIALOG after ok, new name is: " + name + " for instrument: " + instrument + " version: " + version + " nda_name: " + nda_name + " guard_name: " + guard_name);

        console.log("Store now: " + instrument + " with value: " + name);
        store.set('instrument-' + instrument, [name, version, nda_name]);
        store.set('guard-' + instrument, [guard_name]);

        // now update the interface with the new values
        results = [{
            'tags': [name, version, nda_name],
            'item': instrument,
            'prefix': 'instrument-',
            'guard_name': guard_name
        }];
        win.send('updateTagValues', results);

        // now populate the list with the instruments
        // updateInstrumentList( event );
    }
});


ipcMain.on('getEventsFromREDCap', function (event, arg) {
    var token = arg;
    writeLog("get event data from REDCap...");

    getEvents(token);
    getInstrumentEventMapping(token);
    getDataDictionary(token);

    // send back to dialog
    //setupDialog.send('eventsFromREDCap', "DATA FROM REDCAP");
});

ipcMain.on('getItemsForForm', function (event, form) {
    console.log("show items for form :" + form);
    current_form = form;
    var items = [];
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['form_name'] == form) {
            d['order'] = i;
            items.push(d);
        }
    }
    tagstore = store.store; // update the tagstore if we open up another instrument

    win.send('updateItems', items);
});

// save a list of tags for this item [ { 'item': "some_item", 'tags': [ "dont-save" ] } ]
ipcMain.on('setTags', function (event, data) {
    console.log("setTags with: " + JSON.stringify(data));
    // save the tags for this item as
    for (var i = 0; i < data.length; i++) {
        var tag_prefix = 'tag-';
        if (typeof data[i]['prefix'] !== 'undefined')
            tag_prefix = data[i]['prefix'];

        var item = data[i]['item'];
        var tags = store.get('tag-' + item); // existing tags
        if (typeof tags === 'undefined') {
            tags = [];
        }
        if (typeof tags === 'string') { // convert to array if its not already an array
            console.log("found string -> convert to array " + JSON.stringify([ tags ]));
            tags = [ tags ];
        }
        if (typeof data[i]['tags'] === 'string') {
            // this is done on error, we should convert back to array here
            // assume that space is separator
            data[i]['tags'] = data[i]['tags'].split(" ");
        }
        for (var j = 0; j < data[i]['tags'].length; j++) {
            var found = false;
            for (var k = 0; k < tags.length; k++) {
                if (tags[k] == data[i]['tags'][j]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                tags.push(data[i]['tags'][j]);
            }
        }
        // save them again
        store.set(tag_prefix + item, tags);
    }
});

// delete one tag per entry [ { 'item': "some_item", 'tag': "dont-save" } ]
ipcMain.on('deleteTags', function (event, data) {
    // save the tags for this item as

    for (var i = 0; i < data.length; i++) {
        var tag_prefix = 'tag-';
        if (typeof data[i]['prefix'] !== 'undefined') {
            tag_prefix = data[i]['prefix'];
        }
        var item = data[i]['item'];
        var current_tags = store.get(tag_prefix + item);
        if (typeof current_tags === 'string') {
            current_tags = current_tags.split(" ");
        }

        var tags = [];
        if (typeof current_tags === 'undefined') {
            //console.log("Error: there are no tags for item " + tag_prefix + " " + item + ", nothing is removed." + JSON.stringify(data));
            return; // we are done, nothing to remove
        }
        if (tag_prefix == 'instrument-') { // delete all tags for this entry
            store.delete(tag_prefix + item);
            console.log("delete " + tag_prefix + " " + item + " from store");
        } else {
            for (var j = 0; j < current_tags.length; j++) {
                if (data[i]['tags'].indexOf(current_tags[j]) === -1) {
                    tags.push(current_tags[j]);
                }
            }
            if (tags.length == 0) {
                // nothing to save again, remove this tag
                store.delete(tag_prefix + item);
            } else {
                store.set(tag_prefix + item, tags.join(" ")); // store what is left after removing the tags that should be deleted
            }
            // changes the tags, reload
            tagstore = store.store;
        }
    }
});

// returns tags for list of items [ { 'item': "some_item", 'some_other_key': "some other value" } ]
// the input will also be part of the returned array of structures (key 'data')
ipcMain.on('getTags', function (event, data) {
    var results = [];
    //var sto = store.store;
    for (var i = 0; i < data.length; i++) {
        //console.log("called getTags for this item: " + data[i]['item']);
        var tag_prefix = 'tag-';
        if (typeof data[i]['prefix'] !== 'undefined')
            tag_prefix = data[i]['prefix'];
        var tags = undefined;
        if (typeof tagstore[tag_prefix + data[i]['item']] !== 'undefined')
            tags = tagstore[tag_prefix + data[i]['item']];
        if (typeof tags !== 'undefined') {
            results.push({
                'tags': tags,
                'item': data[i]['item'],
                'prefix': tag_prefix
            });
        }
    }
    //console.log("getTags: " + JSON.stringify(data) + " " + JSON.stringify(results));
    win.send('updateTagValues', results);
});

Array.prototype.chunk = function (n) {
    if (!this.length) {
        return [];
    }
    var newar = [];
    while (this.length > 0) {
        newar.push(this.splice(0, n));
    }

    return newar;
};

ipcMain.on('checkData', function (event, data) {
    var form = data['form'];
    //console.log("check the data for this form: " + form);
    // assume that we have access to current_subject_json_data
    var subject_json = current_subject_json_data.reduce(function (acc, a) {
        acc[a['pGUID']] = a;
        return acc;
    }, {});

    // refresh the tag store
    tagstore = store.store;

    // we cannot ask for all items at the same time, we don't have enough memory on the server to get those back
    // lets chunk the items in the form
    var items = [];
    // lets stick with the order of these items in the data dictionary
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['form_name'] == form) {
            items.push(d['field_name']);
        }
    }

    var itemsForForm = [];
    var queue = async.queue(function (chunk, callback) {
        // get data for all item in this form
        var data = {
            'token': token,
            'content': 'record',
            //'forms[0]': form,
            'events[0]': "baseline_year_1_arm_1",
            'events[1]': "6_month_follow_up_arm_1",
            'events[2]': "1_year_follow_up_y_arm_1",
            'events[3]': "18_month_follow_up_arm_1",
            'format': 'json',
            'type': 'flat',
            'rawOrLabel': 'raw',
            'rawOrLabelHeader': 'raw',
            'exportCheckboxLabel': 'false',
            'exportSurveyFields': 'false',
            'exportDataAccessGroups': false,
            'returnFormat': 'json'
        }
        for (var i = 0; i < chunk.length; i++) {
            data['fields[' + i + ']'] = chunk[i];
        }
        // restrict the check to participants that we will exported
        data['fields[' + chunk.length + ']'] = 'nda_year_1_inclusion';

        var headers = {
            'User-Agent': 'Super Agent/0.0.1',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        writeLog("run request now...");
        var url = current_url;
        request({
            method: 'POST',
            url: url,
            form: data,
            headers: headers,
            json: true
        }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                // error case
                //process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
                win.send('alert', JSON.stringify({
                    response: response,
                    error: error,
                    body: body
                }));
                callback("error");
                return;
            }
            //console.log("data from REDCAP: " + JSON.stringify(response));
            win.send('message', "preparing data...");
            data = [];
            // only add data that will be exported
            for (var i = 0; i < body.length; i++) {
                //if (body['nda_year_1_inclusion___1'] !== "1")
                if (!(body['id_redcap'] in subject_json)) {
                    continue;
                }
                data.push(body[i]);
            }

            writeLog("check form: " + form);
            for (var i = 0; i < datadictionary.length; i++) {
                var d = datadictionary[i];
                // only call checkItem for items that we have in the current body
                if (d['form_name'] == form && chunk.indexOf(d['field_name']) !== -1) {
                    checkItem(d['field_name'], form, data, (function (i) {
                        return function (result, status) {
                            win.send('showItemCheck', {
                                item: d['field_name'],
                                form: form,
                                result: result,
                                status: status,
                                order: i
                            });
                        };
                    })(i));
                }
            }
            callback("ok");
        });
    }, 2);

    var allChunksSend2 = false;
    queue.drain = function () {
        process.stdout.write("finished getting data from redcap for checkData\n");
        if (allChunksSend2) {
            win.send('message', "done with checking...");
            writeLog("done with checking...");
        }
        // findProblems( tokens );
    };
    var chunks = items.chunk(40); // get 20 items at the same time from REDCap

    for (var i = 0; i < chunks.length; i++) {
        writeLog('request chunk ' + i + " of " + (chunks.length - 1));
        queue.push([chunks[i]],
            (function (counter, maxCounter) {
                return function (err) {
                    writeLog("finished getting data for chunk: " + counter + " with " + err);
                    win.send('message', "got data for chunk " + counter + "/" + maxCounter);
                };
            })(i, chunks.length)
        );
    }
    allChunksSend2 = true;
});

ipcMain.on('checkItem', function (event, data) {
    var item = data['item'];
    var form = data['form'];
    // get data for that item
    var data = {
        'token': token,
        'content': 'record',
        'fields[0]': item,
        'format': 'json',
        'type': 'flat',
        'rawOrLabel': 'raw',
        'rawOrLabelHeader': 'raw',
        'exportCheckboxLabel': 'false',
        'exportSurveyFields': 'false',
        'exportDataAccessGroups': false,
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = current_url;
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            win.send('alert', "Error: no response from REDCap");
            writeLog("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response));
            return;
        }
        checkItem(item, form, data, function (result, status) {
            win.send('showItemCheck', {
                item: item,
                form: form,
                result: result,
                status: status
            });
        });
    });

});

// Check the form form_name (REDCap) against the nda form, list all the variables that could not be exported
// but should be. 
function verify(form_name, nda) {
    var redcap = [];
    var nda = nda['dataElements'];
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['form_name'] == form_name) {
            // only elements that should be exported are in datadictionary (@HIDDEN and @SHARED are done on reading)

            // only check if it should be exported - is it a descriptive item? - Also superfluous as datadictionary only contains non-descriptive items
            if (d['field_type'] == 'descriptive') {
                writeLog("remove " + d['field_name'] + " - descriptive");
                continue;
            }
            if (d['field_type'] == 'notes') {
                writeLog("remove " + d['field_name'] + " - notes");
                continue;
            }

            // this might actually do something
            var flags = store.get('tag-' + d['field_name']);
            if (typeof flags !== 'undefined') {
                if (flags.indexOf('remove') !== -1) {
                    writeLog("remove " + d['field_name'] + " - remove tag");
                    continue; // don't export this key
                }
            }
            redcap.push(d);
        }
    }
    writeLog("found: " + redcap.length + " items in the redcap instrument that should be checked...");
    var stats = { 'found': 0, 'missing': 0 };
    var txt = "REDCap field_name,status\n";
    // now check each item in redcap against the items in nda
    for (var i = 0; i < redcap.length; i++) {
        var d = redcap[i];
        var found = false;
        for (var j = 0; j < nda.length; j++) {
            // can we actually find this variable - either in ElementName or in Aliases?
            var t = nda[j]['name'];
            t = t.split('___')[0];
            var a = nda[j]['aliases'];
            //console.log("a : " + JSON.stringify(a));
            if (typeof a !== 'undefined' && a.length > 0) { // test for string
                a = a.split(" ");
            } else {
                a = [];
            }

            if (t == d['field_name']) {
                found = true;
                break;
            }
            for (var k = 0; k < a.length; k++) {
                var aa = a[k].split('___')[0];
                if (aa == d['field_name']) {
                    found = true;
                    break;
                }         
                if (found)
                    break;       
            }
        }
        if (!found) {
            txt += d['field_name'] + ",missing on NDA\n";
            stats['missing']++;
        } else {
            stats['found']++;
        }
    }

    writeLog(JSON.stringify(stats));

    return txt;
}

function checkEntryLength(item, l, data, callback) {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        if (typeof data[i][item] !== 'undefined' && data[i][item].length > l) {
            writeLog("  max-length-validation error for item " + item + " in row " + i + ": \"" + data[i][item] + "\" Length: " + data[i][item].length);
            result = result + "max-length-validation [" + data[i][item].length + "/" + l + "], ";
        }
    }
    status = "good";
    if (result.length > 0) {
        status = "bad";
    } else {
        result = "no data longer than " + l;
    }

    (callback)(status + " " + result, status);
}

function checkEntryDateConversion(item, parse_string, data, callback) {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        if (typeof data[i][item] !== 'undefined' && data[i][item] !== "") {
            // use the string to parse the date
            if (!moment(data[i][item], parse_string).isValid()) {
                result = result + "date [" + data[i][item] + " not \"" + parse_string + "\"], ";
            }
        }
    }
    status = "good";
    if (result.length > 0) {
        status = "bad";
    } else {
        result = "data conversion ok";
    }

    (callback)(status + " " + result, status);
}


function checkEntryNumber(item, data, callback) {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        if (data[i][item].match(/[+-]?[0-9][.]?[0-9]/) === null) {
            result = result + "is-number-validation at " + data[i][item].length + ",";
        }
    }
    status = "good";
    if (result.length > 0) {
        status = "bad";
    } else {
        result = "no number conversion error found";
    }

    (callback)(status + " " + result, status);
}

function checkEntryInteger(item, data, callback) {
    var result = "";
    for (var i = 0; i < data.length; i++) {
        if (data[i][item].match(/[+-]?[0-9]/) === null) {
            result = result + "is-integer-validation at " + data[i][item].length + ",";
        }
    }
    status = "good";
    if (result.length > 0) {
        status = "bad";
    } else {
        result = "no integer conversion error found";
    }

    (callback)(status + " " + result, status);
}


function checkItem(item, form, data, callback) {
    // ask REDCap for data and check
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (item == d['field_name']) {
            //var flags = store.get('tag-' + d['field_name']);
            var flags = undefined;
            if (typeof tagstore['tag-' + d['field_name']] !== 'undefined')
                flags = tagstore['tag-' + d['field_name']]
            if (typeof flags !== 'undefined' && flags.indexOf('date') !== -1) { // only check date conversion if this flag is set, nothing else
                // we have to ask
                var convertString = undefined; // = store.get('parse-' + d['field_name']);
                if (typeof tagstore['parse-' + d['field_name']] !== 'undefined')
                    convertString = tagstore['parse-' + d['field_name']];

                checkEntryDateConversion(item, convertString, data, function (result, status) {
                    (callback)(result, status);
                    return;
                });
                return;
            }
            if (d['field_type'] == "text" && d['text_validation_type_or_show_slider_number'] == "number") {
                checkEntryNumber(item, data, function (result, status) {
                    (callback)(result, status);
                });
                return;
            }
            if (d['field_type'] == "text" && d['text_validation_type_or_show_slider_number'] == "integer") {
                checkEntryInteger(item, data, function (result, status) {
                    (callback)(result, status);
                });
                return;
            }

            if (d['field_type'] == "text" && d['text_validation_min'] === '' && d['text_validation_max'] === '') { // text field without validation
                // get the length for this entry
                allowedLength = 30;
                if (typeof flags !== 'undefined') {
                    if (flags.indexOf('long') !== -1)
                        allowedLength = 60;
                    if (flags.indexOf('huge') !== -1)
                        allowedLength = 200;
                }
                checkEntryLength(item, allowedLength, data, function (result, status) {
                    (callback)(result, status);
                    return;
                }); // default entry length
                return;
            }
            if (d['field_type'] == "text" && d['text_validation_min'] !== '' && d['text_validation_max'] !== '') {
                var mi = parseFloat(d['text_validation_min']);
                var ma = parseFloat(d['text_validation_max']);
                status = "good";
                result = "";
                var maxLength = 0;
                var example = '';
                for (var j = 0; j < data.length; j++) {
                    if (typeof data[j][item] !== 'undefined' && data[j][item].length > maxLength) {
                        maxLength = data[j][item].length;
                        example = data[j][item];
                    }
                }
                if (maxLength > ma) {
                    status = "bad";
                    result = result + "max-length validations " + maxLength + "/" + ma + " [" + example + "], ";
                }
                for (var j = 0; j < data.length; j++) {
                    if (typeof data[j][item] !== 'undefined' && data[j][item] !== '' && (data[j][item] < mi || data[j][item] > ma)) {
                        status = "bad";
                        result = result + "range validation error \"" + data[j][item] + "\" [" + mi + "-" + ma + "],";
                    }
                }
                (callback)(result, status);
                return;
            }
            if (d['field_type'] == "notes") {
                (callback)("notes fields will not be exported", "info");
                return;
            }
            if (d['field_type'] == "number") {
                checkEntryNumber(item, data, function (result, status) {
                    (callback)(result, status);
                });
                return;
            }
            if (d['field_type'] == "calc") {
                checkEntryNumber(item, data, function (result, status) {
                    (callback)(result, status);
                });
                return;
            }
        }
    }


    (callback)("good: everything is ok with " + item, "good");
    return;
}

ipcMain.on('openLoadJSONDialog', function (event, data) {
    if (typeof data['filename'] == 'undefined') {
        return;
    }
    current_subject_json = data['filename'][0];

    // read in the json, store the content in current_subject_json_data
    // read with fs.readFileSync 
    var fileName = fs.readFileSync(current_subject_json);
    //var fileName = current_subject_json

    if (fs.existsSync(fileName)) {
        var sj = [];
        try {
            sj = JSON.parse(fs.readFileSync(fileName, 'utf8'));
        } catch (e) {
            if (e instanceof SyntaxError) {
                // Output expected SyntaxErrors.
                writeLog(e);
            } else {
                // Output unexpected Errors.
                writeLog(e, false);
            }
        }
        current_subject_json_data = sj;
    }
});

ipcMain.on('openLoadCSVDialog', function (event, data) {
    if (typeof data['filename'] == 'undefined') {
        return;
    }
    current_aliases_csv = data['filename'][0];

    // read with fs.readFileSync 
    var fileName = fs.readFileSync(current_aliases_csv);
    //var fileName = current_subject_json
    console.log("got called for LoadCSVDialog");

    if (fs.existsSync(current_aliases_csv)) {
        var sj = [];
        try {
            sj = csv().fromFile(current_aliases_csv).then(function (data) {
                console.log("got data from csv: " + JSON.stringify(data));
                /**
                 * [
                 * 	{a:"1", b:"2", c:"3"},
                 * 	{a:"4", b:"5". c:"6"}
                 * ]
                 */
                // import into tags
                if (data.length > 0) {
                    var keys = Object.keys(data[0]);
                    if (!'redcap' in keys) {
                        writeLog("Error: did not find column redcap in data");
                        return;
                    }
                    if (!'aliases' in keys) {
                        writeLog("Error: did not find column aliases in data");
                        return;
                    }
                    var store_items = {};
                    for (var i = 0; i < data.length; i++) {
                        var k = data[i]['redcap'];
                        var d = data[i]['aliases'];
                        // does the field name exist?
                        var found = false;
                        for (var j = 0; j < datadictionary.length; j++) {
                            //console.log("keys: " + Object.keys(datadictionary[j]));
                            if (datadictionary[j].field_name === k) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            writeLog("Error: alias for item: " + d + " cannot be set. Field is not in data dictionary.");
                            continue;
                        }
                        // don't import if it does not exist
                        var vv = store.get('alias-' + k); // do we have a date field here instead of a string?            
                        if (typeof vv === 'undefined') { // add an alias to the data dictionary
                            vv = [];
                        }
                        vv.push(d);
                        var aliases = vv;
                        // remove duplicates (twice import?)
                        var s = new Set(aliases.filter(function (a) {
                            if (a === "") 
                                return false;
                            return true;
                        }));
                        aliases = [...s]; // store as array
                        // aliases = [...s].join(" ").trim();
                        writeLog("Import Aliases: set key " + k + " to: " + aliases + " [" + i + "/" + data.length + "]");
                        // store.set('alias-' + k, aliases);
                        store_items['alias-' + k] = aliases;
                        // and mark that we have an alias here
                        var vv = store.get('tag-' + k);
                        if (typeof vv !== 'undefined' && typeof vv === 'string')
                            vv = vv.split(" "); // convert back to an array 
                        if (typeof vv !== 'undefined' && vv.indexOf('alias') === -1) {
                            // store.set('tag-' + k, vv + " alias");
                            vv.push("alias");
                            store_items['tag-' + k] = vv;
                        } else {
                            // store.set('tag-' + k, "alias");
                            store_items['tag-' + k] = [ "alias" ];
                        }
                    }
                    store.set(store_items);
                }
            });
        } catch (e) {
            if (e instanceof SyntaxError) {
                // Output expected SyntaxErrors.
                writeLog(e);
            } else {
                // Output unexpected Errors.
                writeLog(e, false);
            }
        }
    }
});

function writeLog(t) {
    console.log(t);
    win.send('info',t);
}

ipcMain.on('exportData', function (event, data) {
    var filename = data['filename'];
    var form = data['form'];
    writeLog("start writing data to disk " + filename + " ...");

    tagstore = store.store; // update tag store for speed up of lookup below

    // lets also write a report to disk
    var report = data['filename'];
    report = path.join(path.dirname(report), path.basename(report, path.extname(report)) + "_report.txt");
    var rstr = "### Data Export Report " + form + "\n\n";
    anyErrorDownloading = false;

    // what is the name of this instrument?
    var form_name = instrumentLabels[form];
    var form_version = "1";
    var form_nda_name = form_name;
    var v = store.get('instrument-' + form);
    if (typeof v !== 'undefined') {
        if (typeof v[0] !== 'undefined')
            form_name = v[0];
        if (typeof v[1] !== 'undefined')
            form_version = v[1];
        if (typeof v[2] !== 'undefined')
            form_nda_name = v[2];
    }
    var v2 = store.get('guard-' + form);
    var guard_variable = "";
    if (typeof v2 !== 'undefined') {
        guard_variable = v2[0];
        writeLog("guard variable exists for this instrument " + guard_variable);
    }

    // what are the events this instrument should be querried for
    var master_list_events = ["screener_arm_1", "baseline_year_1_arm_1", "6_month_follow_up_arm_1", "1_year_follow_up_y_arm_1", "18_month_follow_up_arm_1"]
    //console.log(JSON.stringify(instrumentEventMapping));
    for (var i = 0; i < master_list_events.length; i++) {
        var event = master_list_events[i];
        found = false;
        for (obj in instrumentEventMapping) {
            var v = instrumentEventMapping[obj];
            if (v['unique_event_name'] == event && v['form'] == form) {
                found = true;
            }
        }
        if (!found) {
            delete master_list_events[i];
        }
    }
    // filter out deleted events (Object.values())
    master_list_events = Object.keys(master_list_events).map(function (a) {
        if (typeof master_list_events[a] !== 'undefined') 
            return master_list_events[a];
    });

    var items = [];
    if (guard_variable !== "") {
        // guard variable could be a checkbox, split and use the first part
        gv = guard_variable.split("___")[0];
        items.push(gv);
    }

    var dateConversions = {};
    var missingItems = []; // keep track of missing columns
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['form_name'] == form) {
            // ignore HIDDEN
            if (typeof d['field_annotation'] !== 'undefined' && d['field_annotation'].indexOf("@HIDDEN") !== -1 && d['field_annotation'].indexOf("@SHARED") === -1) {
                rstr = rstr + "Info: item " + d['field_name'] + " has @HIDDEN annotation (and no @SHARED annotation) and will not be exported\n";
                writeLog("Info: item " + d['field_name'] + " has @HIDDEN annotation (and no @SHARED annotation) and will not be exported");
                continue;
            }
            if (typeof d['field_type'] !== 'undefined' &&
                (d['field_type'] == 'descriptive' || d['field_type'] == 'notes')) {
                rstr = rstr + "Info: item " + d['field_name'] + " is descriptive or notes type and will not be exported\n";
                writeLog("Info: item " + d['field_name'] + " is descriptive or notes type and will not be exported");
                continue;
            }
            // ignore items that are not in the NDA version of this instrument
            if (restrictToNDA.length > 0) {
                // check if this item is in the allowed export list
                found = false;
                var na = d['field_name'];
                na = na.split('___')[0];
                for (var j = 0; j < restrictToNDADD['dataElements'].length; j++) {
                    // we could have underscores in there as well
                    var name = restrictToNDADD['dataElements'][j]['name'];
                    name = name.split('___')[0];
                    if (na == name) {
                        found = true;
                        break;
                    }
                    // check for translations as well
                    for (var k = 0; k < restrictToNDADD['dataElements'][j]['aliases'].length; k++) {
                        var naa = restrictToNDADD['dataElements'][j]['aliases'][k];
                        naa = naa.split('___')[0];
                        if (naa == na) {
                            found = true;
                            break;
                        }
                    }
                    if (found)
                        break;
                }
                if (!found) {
                    if (missingItems.indexOf(d['field_name']) < 0) {
                        rstr = rstr + "Info: Missing item " + d['field_name'] + " in NDA data dictionary " + restrictToNDA + ". Item will not be exported.\n";
                        writeLog("Info: Missing item " + d['field_name'] + " in NDA data dictionary " + restrictToNDA + ". Item will not be exported.");
                        missingItems.push(d['field_name']);
                    }
                    continue;
                }
            }

            if (removeAnyText) {
                // this global flag indicates if normal text fields should be removed from the export
                // a normal text field is a text field that is not a date/number/integer
                if (d['field_type'] == "text" && d['text_validation_type_or_show_slider_number'] == '') {
                    rstr = rstr + "Info: item " + d['field_name'] + " is type text without validation and will not be exported.\n";
                    writeLog("Info: item " + d['field_name'] + " is type text without validation and will not be exported.");
                    continue;
                }
            }
            var flags = undefined; // = store.get('tag-' + d['field_name']);
            if (typeof tagstore['tag-' + d['field_name']] !== 'undefined')
                flags = tagstore['tag-' + d['field_name']];
            var removeDetails = undefined;
            if (typeof tagstore['remove-' + d['field_name']] !== 'undefined')
                removeDetails = tagstore['remove-' + d['field_name']];
            if (typeof flags !== 'undefined') {
                if (flags.indexOf('remove') !== -1) {
                    if (removeDetails !== undefined && removeDetails !== "") {
                        rstr = rstr + "Info: item " + d['field_name'] + " is marked as 'remove' but only for events " + removeDetails + ". Export is disabled for these events.\n";
                        writeLog("Info: item " + d['field_name'] + " is marked as 'remove' but only for events " + removeDetails + ". Export is disabled for these events.");
                    } else {
                        rstr = rstr + "Info: item " + d['field_name'] + " is marked as 'remove' and will not be exported.\n";
                        writeLog("Info: item " + d['field_name'] + " is marked as 'remove' and will not be exported.");
                        continue;
                    }
                }
            }

            items.push(d['field_name']);

            // each item could have a parse_string assigned to it
            if (typeof flags !== 'undefined') {
                if (flags.indexOf('date') !== -1) {
                    var parse_string = undefined; // = store.get('parse-' + d['field_name']);
                    if (typeof tagstore['parse-' + d['field_name']] !== 'undefined')
                        parse_string = tagstore['parse-' + d['field_name']];
                    if (typeof parse_string !== 'undefined') {
                        dateConversions[d['field_name']] = parse_string;
                        rstr = rstr + "Info: Parse string \"" + parse_string + "\" found for: " + d['field_name'] + "\n";
                        writeLog("Info: Parse string \"" + parse_string + "\" found for: " + d['field_name']);
                    }
                }
            }
        }
    }
    writeLog("total number of items to pull from REDCap: " + items.length);
    if (restrictToNDA.length > 0) {
        writeLog(" missing items on NDA (removed from export): " + missingItems.length);
    }

    // do we need to get label data for BIOPORTAL entries as well?
    var bioportalVars = []; // pull these values as string instead of as number
    for (var i = 0; i < datadictionary.length; i++) {
        if (form == datadictionary[i]['form_name'] && datadictionary[i]['select_choices_or_calculations'] == "BIOPORTAL:RXNORM") {
            var name = datadictionary[i]['field_name'];
            bioportalVars.push(name + "___BIOPORTAL"); // mark these as special
        }
    }
    if (bioportalVars.length > 0) {
        writeLog("Warning: need to pull labels for BIOPORTAL entries as well...");
        rstr = rstr + "Info: BIOPORTAL variables detected: [ " + bioportalVars.join(", ") + " ]\n";
    }

    //console.log("erstes Element is: " + items[0]);
    var itemsPerRecord = [];
    var queue = async.queue(function (options, callback) {
        var chunk = options['chunk'][0];
        var current_events = options['events'];
        var limitParticipants = options['limitParticipants'];
        // do we have a BIOPORTAL chunk here?
        var getLabel = false;
        if (chunk[0].indexOf("___BIOPORTAL") > 0) {
            //console.log("Asked to pull BIOPORTAL variables from REDCap...");
            getLabel = true;
        }

        //console.log("chunk is: " + JSON.stringify(chunk));
        var data = {
            'token': token,
            'content': 'record',
            //'forms[0]': form,
            'fields[0]': 'id_redcap',
            'fields[1]': 'redcap_event_name',
            //   'fields[2]': 'nda_year_1_inclusion',
            //'fields[3]': 'asnt_timestamp',
            //'events[0]': "baseline_year_1_arm_1",
            //'events[1]': "6_month_follow_up_arm_1",
            //'events[2]': "1_year_follow_up_y_arm_1",
            //'events[3]': "18_month_follow_up_arm_1",           
            'format': 'json',
            'type': 'flat',
            'rawOrLabel': getLabel ? 'label' : 'raw',
            'rawOrLabelHeader': 'raw',
            'exportCheckboxLabel': 'false',
            'exportSurveyFields': 'false',
            'exportDataAccessGroups': false,
            'returnFormat': 'json'
        }

        if (current_event != "ALL") {
            // in this case we don't want to use current_events (master list of events for this form)
            // instead we use the current event only
            current_events = [current_event];
        }

        if (limitParticipants.length > 0) {
            for (var i = 0; i < limitParticipants.length; i++) {
                data['records[' + i + ']'] = limitParticipants[i];
            }
        }

        for (var i = 0; i < current_events.length; i++) {
            data['events[' + i + ']'] = current_events[i];
        }


        for (var i = 0; i < chunk.length; i++) {
            if (getLabel) {
                var l = chunk[i].split("___BIOPORTAL")[0];
                data['fields[' + (i + 2) + ']'] = l;
            } else {
                data['fields[' + (i + 2) + ']'] = chunk[i];
            }
        }
        //console.log("got chunk of size " + chunk.length + " call: " + JSON.stringify(data));
        writeLog("ask for these scores from REDCap: " + JSON.stringify(data));
        var headers = {
            'User-Agent': 'Super Agent/0.0.1',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        var url = current_url;
        request({
            method: 'POST',
            url: url,
            form: data,
            headers: headers,
            json: true
        }, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                // error case
                process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
                win.send('alert', JSON.stringify(response));
                win.send('info', JSON.stringify(response));
                callback("error");
                return;
            }
            //console.log("getting data from REDCap done once");
            win.send('message', "preparing data for save...");
            data = body;

            // we have to merge these (items for each user) every time before we can export them
            for (var i = 0; i < data.length; i++) {
                // find this participant and event in itemsPerRecord
                var dat = data[i];
                if (getLabel) { // we should keep the variables separate - add BIOPORTAL back
                    //console.log("what is in dat?");
                    var dat2 = {};
                    var k2 = Object.keys(dat);
                    for (var j = 0; j < k2.length; j++) {
                        if (k2[j] == 'asnt_timestamp' ||
                            k2[j] == 'id_redcap' ||
                            k2[j] == 'nda_year_1_inclusion___1' ||
                            k2[j] == 'redcap_event_name') {
                            dat2['id_redcap'] = dat['id_redcap'];
                            // dat2['redcap_event_name'] = current_event;
                        } else {
                            dat2[k2[j] + '___BIOPORTAL'] = dat[k2[j]];
                        }
                    }
                    dat = dat2;
                }
                // find the unique_event_name (trivial for non BIOPORTAL, but for BIOPORTAL we have to check in allEvents to find the unique name)
                var uniqueName = "";
                if (getLabel) { // we will get the wrong name
                    for (e in allEvents) {
                        var entry = allEvents[e];
                        if (entry['event_name'] == data[i]['redcap_event_name']) {
                            uniqueName = entry['unique_event_name'];
                            break;
                        }
                    }
                    if (uniqueName == "") {
                        console.log("Error: unknown event name " + data[i]['redcap_event_name']);
                    }
                } else {
                    uniqueName = data[i]['redcap_event_name'];
                }
                var found = false;
                for (var j = 0; j < itemsPerRecord.length; j++) {
                    var item = itemsPerRecord[j];
                    if (item['id_redcap'] == data[i]['id_redcap'] && item['redcap_event_name'] == uniqueName) {
                         // current_events.indexOf(item['redcap_event_name']) > -1) {
                        itemsPerRecord[j] = Object.assign({}, itemsPerRecord[j], dat); // copy the key/values from both into one
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    itemsPerRecord.push(dat);
                }
                // itemsPerRecord.push(dat); // will be merged below
            }
            callback("ok");
        });
    }, 2);

    // could be called several times, should check if all chunks have been added
    var allChunksSend = false;
    queue.drain = function () {
        console.log("drain called...");
        if (allChunksSend && anyErrorDownloading['numBad'] > 0) {
            win.send("message", "Error: there was a download error, we will not create the output files because there might be missing data.");
            win.send('info', "Error: there was a download error, we will not create the output files because there might be missing data.");
            writeLog("Error: there was a download error, we will not create the output files because there might be missing data.");
        }
        if (allChunksSend && anyErrorDownloading['numBad'] == 0) {
            writeLog("finished getting data from redcap at this point, save itemsPerRecord to file: " + filename);
            var rxnorm_cache = {};

            // we need to add some standard columns at the beginning that identify the dataset on NDA
            // subjectkey	src_subject_id	interview_date	interview_age	gender	eventname

            // itemsPerRecord could have a mix of all the events in it, in that case we would end up with some data
            // from the screener in a different row as data from the baseline, we should merge them together into
            // a single row
            data = {}; // create a single event set
            for (var i = 0; i < itemsPerRecord.length; i++) {
                if (0 === (i % 10000)) {
                    writeLog("create event set: " + i + "/" + itemsPerRecord.length);
                }
                var d = itemsPerRecord[i];
                var id = d['id_redcap']+d['redcap_event_name'];
                if (!(id in data)) {
                    // lets do a deep copy here
                    data[id] = {};
                }
                for (var key in d) {
                    if (!(key in data[id]) || d[key] !== "") {
                        data[id][key] = d[key];
                    }
                }
                //} else { // this should not be needed anymore, the pull already merges using Object.assign
                //    var keys = Object.keys(d);
                //    for (var j = 0; j < keys.length; j++) {
                //        if (!(keys[j] in data[d['id_redcap']]) || d[keys[j]] !== "") {
                //            data[d['id_redcap']][keys[j]] = d[keys[j]];
                //        }
                //    }c
                //}
            }
            //console.log("make event name the current event...");
            //console.log(data)
            data = Object.keys(data).map(function (key) {
                //data[key]['redcap_event_name'] = current_event;
                return data[key];
            })
            //console.log(data)

            //data = itemsPerRecord;
            if (restrictToNDA.length > 0) {
                form_nda_name = restrictToNDA;
                // try to get the version number seperate
                var vals = null;
                if ( (vals = form_nda_name.match(/(.*)(0[1-9])$/)) !== null) {
                    form_nda_name = vals[1];
                    form_version = parseInt(vals[2]);
                }
            }
            str = "\"" + form_nda_name + "\"," + form_version + "\n"; // form name could contain commas 
            // add the header
            //console.log(data[0])
            //console.log(Object.keys(data[0]))
            var keys = Object.keys(data[0]);
            // sort keys by order in datadictionary
            //console.log("sort these keys: " + JSON.stringify(keys));
            // sort does this in place... shouldn't this be just keys.sort?
            var sortedKeys = keys; //[];

            /*for(var i = 0; i < keys.length; i++){
                s = keys[i];
                var ssplit = s.split('___');
                if (ssplit.length === 2){
                    s = ssplit[0]
                }
                var flag = false
                for (var j = 0; j < datadictionary.length; j++){
                    if (datadictionary[j]['field_name'] == s){
                        flag = true 
                        break
                    }
                }
                if(flag){
                    sortedKeys.push(s)
                }
            }*/

            console.log("start sorting the keys...");
            sortedKeys.sort(function (a, b) { // TODO FIX THIS; make sure it matches the datadicgtionary 
                var idxA = -1;
                var idxB = -1;
                var astr = a;
                var bstr = b;
                var asplit = a.split('___');
                var bsplit = b.split('___');

                if (asplit.length === 2) {
                    astr = asplit[0];
                }
                if (bsplit.length === 2) {
                    bstr = bsplit[0];
                }
                for (var i = 0; i < datadictionary.length; i++) {
                    //console.log(datadictionary[i]['field_name'])
                    if (datadictionary[i]['field_name'] == astr) {
                        idxA = i;
                        break;
                    }
                }
                for (var i = 0; i < datadictionary.length; i++) {
                    // checkbox?
                    if (datadictionary[i]['field_name'] == bstr) {
                        idxB = i;
                        break;
                    }
                }
                return (idxA > idxB) ? 1 : ((idxA < idxB) ? -1 : 0);
            });

            // read in the additional subject information from the current_subject_json
            subject_json = {};
            writeLog("read subject information...");
            if (current_subject_json == "") {
                writeLog("Error: no current_subject_json file specified");
            } else {
                if (fs.existsSync(current_subject_json)) {
                    var sj = [];
                    try {
                        sj = JSON.parse(fs.readFileSync(current_subject_json, 'utf8'));
                    } catch (e) {
                        if (e instanceof SyntaxError) {
                            // Output expected SyntaxErrors.
                            writeLog(e);
                        } else {
                            // Output unexpected Errors.
                            writeLog(e, false);
                        }
                    }
                    // get the pGUID as key
                    for (var j = 0; j < sj.length; j++) {
                        subject_json[sj[j]['pGUID']] = sj[j];
                    }
                    // we expect some keys in this file, like pGUID, gender, and dob
                } else {
                    writeLog("Error: file does not exist " + current_subject_json);
                }
            }

            var skipkeys = [];
            var count = 0;
            writeLog("Create csv file content...");
            for (var j = 0; j < sortedKeys.length; j++) {
                var k = sortedKeys[j];
                if (k == 'id_redcap') {
                    k = 'subjectkey,src_subject_id,interview_date,interview_age,gender,eventname';
                    // we need more: subjectkey	src_subject_id	interview_date	interview_age	gender	eventname
                }
                if (k == 'redcap_event_name' ||
                    k == "nda_year_1_inclusion___1" ||
                    k == (form + "_complete") ||
                    k == guard_variable ||
                    k == 'asnt_timestamp')
                    continue; // don't export, is grouped with id_redcap
                if (k.indexOf("___BIOPORTAL") > 0) {
                    skipkeys.push(k);
                    continue;
                }
                var flags = undefined; // = store.get('tag-' + k);
                if (typeof tagstore['tag-' + k] !== 'undefined')
                    flags = tagstore['tag-' + k];
                if (typeof flags !== 'undefined') {
                    if (flags.indexOf('remove') !== -1) {
                        // we only remove here if there is no list of events - equals remove for all events
                        var removeDetails = undefined;
                        if (tagstore['remove-' + k] !== 'undefined' && tagstore['remove-' + k] !== "") {
                            // keep this variable, it might be enabled for some events
                        } else {
                            skipkeys.push(k);
                            continue; // don't export this key
                        }
                    }
                }
                if (count > 0)
                    str = str + "," + k;
                else
                    str = str + k;

                count = count + 1;
            }
            str = str + "\n";
            console.log("Write csv file header ...");
            try {
                fs.writeFileSync(filename, str);
            } catch (e) {
                win.send('alert', 'Could not save to file: ' + filename);
                writeLog('Could not save to file: ' + filename);
            }

            var ds = {}; // a cache for data dictionary entries - gets filled during the first iteration
            var flags_cache = {}; // a cache for the flags
            // write out sorted by event - just to make this easier to read
            var line = 0;
            for (var ev = 0; ev < master_list_events.length; ev++) {
                for (var i = 0; i < data.length; i++) {
                    // check instead if data[i]['id_redcap'] is in subjects_json as a key
                    // check if data[i]['redcap_event_name'] is in subjects_json[pGUID].interview_age + ""
                    //var interview_age_key = "interview_age_" + data[i]['redcap_event_name'];
                    interview_event = data[i]['redcap_event_name']
                    if (interview_event !== master_list_events[ev])
                        continue;

                    // We want to use screener event data as baseline data. Only baseline data has a checkbox for sharing,
                    // and only baseline data should appear in the output
                    if (typeof data[i]['redcap_event_name'] !== 'undefined' && data[i]['redcap_event_name'] == "screener_arm_1") {
                        data[i]['redcap_event_name'] = "baseline_year_1_arm_1";
                        interview_event = data[i]['redcap_event_name']
                    }

                    // can we skip because of the guard variable?
                    if (guard_variable !== "") {
                        if (typeof data[i][guard_variable] === 'undefined' || data[i][guard_variable] !== "1") { // only 1 will do
                            continue;
                        }
                    }

                    //console.log(interview_age_key)
                    if ((data[i]['id_redcap'] in subject_json) && (data[i]['redcap_event_name'] in subject_json[data[i]['id_redcap']])) {
                        //if((data[i]['id_redcap'] in subject_json)) {
                        // if (data[i]['nda_year_1_inclusion___1'] == "1") {
                        // export this participants data
                        str = "";
                        var keys = Object.keys(data[i]);
                        for (var j = 0; j < sortedKeys.length; j++) {
                            var name = sortedKeys[j];
                            if (name == "redcap_event_name" ||
                                name == "nda_year_1_inclusion___1" ||
                                name == guard_variable ||
                                name == "asnt_timestamp" ||
                                name == (form + "_complete"))
                                continue; // skip, is exported next to id_redcap

                            // skip entries if they are from BIOPORTAL (is added automatically to raw item)
                            if (name.indexOf('___BIOPORTAL') > 0) {
                                continue;
                            }

                            // skip this key if its not needed
                            if (skipkeys.indexOf(name) !== -1) {
                                continue; // don't export this key
                            }

                            var label = '';
                            if (typeof data[i][name] !== 'undefined') { // a key we have not seen before
                                // we could have a key here that contains '___'    
                                label = data[i][name];
                                var na = name;
                                if (name.split("___").length > 1) {
                                    na = name.split("___")[0];
                                }
                                var flags = [];
                                var flag_name = 'tag-' + na;
                                if (flag_name in flags_cache) {
                                    flags = flags_cache[flag_name];
                                } else { // store.get is expensive - only do this the first time
                                    flags = store.get(flag_name);
                                    flags_cache[flag_name] = flags;
                                }
                                if (typeof flags !== 'undefined' && flags.indexOf('label') !== -1)
                                    label = mapValueToString(name, label);

                                //
                                // lets test if we should replace "0" with "" if the clearlabel flag is set
                                //
                                if (typeof flags !== 'undefined' &&
                                    name.split("___").length > 1 &&
                                    flags.indexOf('clearcheckboxes') !== -1) {
                                    // check if there is any value set to !0 for this name
                                    na = name.split("___")[0];
                                    foundOne = false;
                                    for (var k = 0; k < keys.length; k++) {
                                        if (keys[k].indexOf(na + "___") === 0) {
                                            if (data[i][keys[k]] !== "0") {
                                                foundOne = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (!foundOne) {
                                        // set this label to empty (no other checkbox is set, all are "0")
                                        label = "";
                                    }
                                }
                            }
                            // do we have to perform a date conversion?
                            if (label !== '' && typeof dateConversions[name] !== 'undefined') {
                                // convert this value given the parse information to the NDA date format
                                label = moment(label, dateConversions[name]).format("MM/DD/YYYY");
                            }
                            // build the cache for data dictionary entries
                            var d = []; // current entry in data dictionary - find once and keep
                            if (name in ds) {
                                d = ds[name];
                            } else {
                                var na = name;
                                if (name.split("___").length > 1) {
                                    na = name.split("___")[0];
                                }
                                for (var k = 0; k < datadictionary.length; k++) {
                                    if (na == datadictionary[k]['field_name']) {
                                        d = datadictionary[k];
                                        ds[name] = datadictionary[k];
                                        break;
                                    }
                                }
                            }
                            if (d == []) {
                                writeLog("Error: Could not find data dictionary entry for " + name);
                            }
                            if (d['select_choices_or_calculations'] == "BIOPORTAL:RXNORM") {
                                // lookup the label variable
                                var nname = name + '___BIOPORTAL';
                                if (sortedKeys.indexOf(nname) >= 0 && data[i][nname].length > 0) {
                                    label = label + " " + data[i][nname];
                                }
                            }

                            if (name == d['field_name'] &&
                                (d['text_validation_min'] !== "" ||
                                    d['text_validation_max'] !== "")) {
                                var mi = d['text_validation_min'];
                                var ma = d['text_validation_max'];
                                if (mi !== "") {
                                    if (parseFloat(label) < mi) {
                                        rstr = rstr + "Warning: value for " + name + " " + label + " < " + mi + " for " + data[i]['id_redcap'] + ". Value will be deleted!\n";
                                        label = "";
                                    }
                                }
                                if (ma !== "") {
                                    if (parseFloat(label) > ma) {
                                        rstr = rstr + "Warning: value for " + name + " " + label + " > " + ma + " for " + data[i]['id_redcap'] + ". Value will be deleted!\n";
                                        label = "";
                                    }
                                }
                            }

                            if (name == d['field_name'] &&
                                d['text_validation_type_or_show_slider_number'] == "integer") {
                                if (label.match(/^[-+]?[0-9]*$/) === null) {
                                    rstr = rstr + "Warning: measure not integer valued in item " + name + " \"" + label + "\" for " + data[i]['id_redcap'] + ". Consider changing this value, it will be deleted.\n";
                                    label = "";
                                }
                            }
                            if (name == d['field_name'] &&
                                d['text_validation_type_or_show_slider_number'] == "number") {
                                if (label.match(/^-?\d*\.?\d*$/) === null) {
                                    rstr = rstr + "Warning: measure not floating point valued in item " + name + " \"" + label + "\" for " + data[i]['id_redcap'] + ". Consider changing this value, it will be deleted.\n";
                                    label = "";
                                }
                            }

                            if (name == d['field_name'] &&
                                d['select_choices_or_calculations'] !== "" && label !== "" && d['select_choices_or_calculations'] !== 'BIOPORTAL:RXNORM') {
                                // check if the current value "label" is one of the approved choices in 'select_choices_or_calculations'
                                // do we have choices in here? Could be a calculation!! we need at least a comma value
                                // we can have a comma in here, if there is a if we will find a comma!
                                var part = d['select_choices_or_calculations'].split(",");
                                if (part.length > 1 && part[0].toLowerCase().indexOf('(') == -1) { // instead of removing "(" we should test the type of the variable
                                    var ch = d['select_choices_or_calculations'].split("|").map(function(a) { return a.split(",")[0].trim(); });
                                    if (ch.indexOf(label) == -1) {
                                        rstr = rstr + "Warning: invalid value for participant " + pGUID + " " + d['field_name'] + ": \"" + label + "\" (allowed values: "+ch.join(",")+"). Set to missing.\n";
                                        label = "";
                                    }
                                }
                            }

                            // if the current event is listed in the tag remove-<item> we don't want to export
                            if (typeof tagstore['remove-'+d['field_name']] !== 'undefined') {
                                if (tagstore['remove-'+d['field_name']].split(" ").indexOf(data[i]['redcap_event_name']) > -1) {
                                    // we found this event with a remove checkbox enabled ... don't export the value here - set label to ""
                                    rstr = rstr + "Warning: for this item and event the values are not exported (" + pGUID + ", " + data[i]['redcap_event_name'] + ", " + d['field_name'] + "). Set to missing.\n";
                                    label = "";
                                    // but we might never get here if the 'D' is already checked above
                                }
                            }


                            label = label.replace(/\"/g, "\"\"\"");
                            if (name == "id_redcap") {
                                // we need more: subjectkey	src_subject_id	interview_date	interview_age	gender	eventname
                                //interview_date = data[i]['asnt_timestamp']; // TODO FIX THIS; update to use values in release2.0json
                                interview_age = ""; // in month
                                gender = "";
                                found = false;
                                // find the missing information in the subject_json structure loaded from outside file
                                pGUID = data[i][name];
                                if (typeof subject_json[pGUID] === 'undefined') {
                                    rstr = rstr + "Error: could not find subject " + pGUID + " in subject JSON file " + current_subject_json + ".\n";
                                    // still convert the interview_date
                                    interview_date = visit.format('MM/DD/YYYY');
                                } else {
                                    gender = subject_json[pGUID]['gender'];
                                    var dob = moment(subject_json[pGUID]['dob'], 'YYYY-MM-DD');
                                    var visit = moment(data[i]['asnt_timestamp'], 'YYYY-MM-DD HH:mm');
                                    if (typeof dob == 'undefined') {
                                        rstr = rstr + "Error: date of birth (dob) for " + pGUID + " cannot be read (" + subject_json[pGUID]['dob'] + ") as YYY-MM-DD.";
                                        dob = '';
                                    }
                                    if (typeof interview_age == 'undefined') {
                                        rstr = rstr + "Error: interview_age for " + pGUID + " cannot be read (" + subject_json[pGUID]['asnt_timestamp'] + ") as YYY-MM-DD HH:mm.";
                                        interview_age = '';
                                    }
                                    interview_date = subject_json[pGUID][interview_event]["interview_date"];
                                    // use the interview age from this entry
                                    interview_age = subject_json[pGUID][interview_event]["interview_age"];
                                    //console.log(interview_age_key)
                                    //console.log(interview_age)
                                    if (typeof interview_age === 'undefined') {
                                        rstr = rstr + "Error: no interview_age value " + interview_event + " for participant " + pGUID + "\n";
                                    }
                                    //interview_age = visit.diff(dob, 'month', false); // use the dob and the asnt_timestamp

                                    // We have to fix the ages here because kids are included into the study
                                    // based on a real date but the dob is given to us at the 15th of the month only.
                                    // So if a kid is in the study and has interview_age of 107 we know that their 
                                    // birthday must have been in relation to the visit date (real date).
                                    // For now lets clamp the interview_age to 108 ... 131.
                                    if (data[i]['redcap_event_name'] == 'baseline_year_1_arm_1' && interview_age < 108) {
                                        rstr = rstr + "Warning: interview_age in month for " + pGUID + " is " + interview_age + " < 108. This could allow someone to guess the age by less than 30 days. Set age in month to 108.\n";
                                        interview_age = 108;
                                    }
                                    if (data[i]['redcap_event_name'] == 'baseline_year_1_arm_1' && interview_age > 131) {
                                        rstr = rstr + "Warning: interview_age in month for " + pGUID + " is " + interview_age + " > 131. This could allow someone to guess the age by less than 30 days. Set age in month to 131.\n";
                                        interview_age = 131;
                                    }
                                }
                                str = str + data[i][name] + "," +
                                    data[i][name] + "," +
                                    interview_date + "," +
                                    interview_age + "," +
                                    gender + "," +
                                    data[i]['redcap_event_name'];
                                count = count + 1;
                            } else {
                                if (count > 0)
                                    str = str + ",\"" + label + "\"";
                                else
                                    str = str + "\"" + label + "\"";
                                count = count + 1;
                            }
                        }
                        str = str + "\n";
                        if (line % 100 == 0) {
                            writeLog("create file line: " + line + "/" + data.length);
                        }
                        line++;        

                        try {
                            fs.appendFileSync(filename, str);
                        } catch (e) {
                            win.send('alert', 'Could not append to file: ' + filename);
                        }
                    }
                }
            }
            writeLog("Write out report...");
            try {
                fs.writeFile(report, rstr, function (err) {
                    if (err) {
                        return writeLog(err);
                    } else {
                        writeLog("The report file was saved...");
                    }
                });
            } catch (e) {
                win.send('alert', 'Could not save to report file: ' + report);
                writeLog('Could not save to report file: ' + report);
            }
            win.send('message', "done with save...");
            writeLog("done with save...");
        }
    };
    // initialize the download error tracker
    anyErrorDownloading = {
        'errors': [],
        'numOk': 0,
        'numBad': 0
    }
    // todo on drain we should display the errors --- or refuse to drain!

    // we need to check how many participants we have to pull, if its less than 1000, name them in the call
    subject_json = {};
    writeLog("read subject information...");
    if (current_subject_json == "") {
        writeLog("Error: no current_subject_json file specified");
    } else {
        if (fs.existsSync(current_subject_json)) {
            var sj = [];
            try {
                sj = JSON.parse(fs.readFileSync(current_subject_json, 'utf8'));
            } catch (e) {
                if (e instanceof SyntaxError) {
                    // Output expected SyntaxErrors.
                    writeLog(e);
                } else {
                    // Output unexpected Errors.
                    writeLog(e, false);
                }
            }
            // get the pGUID as key
            for (var j = 0; j < sj.length; j++) {
                subject_json[sj[j]['pGUID']] = sj[j];
            }
            // we expect some keys in this file, like pGUID, gender, and dob
        } else {
            writeLog("Error: file does not exist " + current_subject_json);
        }
    }
    var limitParticipants = []; // don't limit by default, call data for all participants
    if (Object.keys(subject_json).length < 1000) {
        limitParticipants = Object.keys(subject_json);
    }

    var chunks = items.chunk(20); // get 20 items at the same time from REDCap
    for (var i = 0; i < chunks.length; i++) {
        queue.push({
                'chunk': [chunks[i]],
                "events": master_list_events,
                "limitParticipants": limitParticipants
            },
            (function (counter, maxCounter, anyErrorDownloading) {
                return function (err) {
                    writeLog("finished getting data for chunk: " + counter + " with " + err);
                    if (err == 'ok') {
                        anyErrorDownloading['numOk']++;
                        win.send('message', "got data for chunk " + counter + "/" + maxCounter);
                        writeLog("got data for chunk " + counter + "/" + maxCounter);
                    } else {
                        anyErrorDownloading['numBad']++;
                        anyErrorDownloading['errors'].push(err);
                        win.send('error', "ERROR on download " + counter + "/" + maxCounter);
                        writeLog( "ERROR on download " + counter + "/" + maxCounter);
                    }
                };
            })(i, chunks.length, anyErrorDownloading)
        );
    }
    // if we have bioportal code, ask for those values as well here
    if (bioportalVars.length > 0) { // don't do this now
        var chunks = bioportalVars.chunk(20);
        for (var i = 0; i < chunks.length; i++) {
            queue.push({
                'chunk': [chunks[i]],
                "events": master_list_events,
                "limitParticipants": limitParticipants
                },
                (function (counter, maxCounter) {
                    return function (err) {
                        writeLog("finished getting data for BIOPORTAL chunk: " + counter + " with " + err);
                        if (err == "ok") {
                            anyErrorDownloading['numOk']++;
                            win.send('message', "got data for BIOPORTAL chunk " + counter + "/" + maxCounter);
                            writeLog("got data for BIOPORTAL chunk " + counter + "/" + maxCounter);
                        } else {
                            anyErrorDownloading['numBad']++;
                            anyErrorDownloading['errors'].push(err);
                            win.send('message', "Error getting BIOPORTAL chunk " + counter + "/" + maxCounter);
                            writeLog("Error getting BIOPORTAL chunk " + counter + "/" + maxCounter);
                        }
                    };
                })(i, chunks.length, anyErrorDownloading)
            );
        }
    }
    allChunksSend = true;
});

// lookup an items code and return the string that represents the value
function mapValueToString(item, value) {
    var ret = value;
    if (value == "") // values are allowed to be empty
        return ret;
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['field_name'] == item && (d['field_type'] == "checkbox" || d['field_type'] == "radio")) {
            var choices = d['select_choices_or_calculations'].split("|");
            var m = {};
            for (var j = 0; j < choices.length; j++) {
                var k = choices[j].split(",")[0].trim();
                var val = choices[j].split(",")[1].trim();
                m[k] = val;
            }
            // now apply this map
            if (typeof m[value] !== 'undefined') {
                ret = m[value];
            } else {
                ret = "ERROR: value \"" + value + "\" not in allowed range";
            }
            break;
        }
    }
    return ret;
}

function unHTML(str) {
    var s = str;
    if (typeof str === 'undefined') {
        return "";
    }
    // we might have no spaces between the spanish and english versions, lets add some first
    str = str.replace(/\<\/span\>/g, "</span> ");
    str = striptags(str);
    str = str.replace(/\&nbsp/g, " ");
    str = str.trim();

    // we could have our own html-ish tags here, try to remove those as well
    var regex = /(##en##)/ig
    str = str.replace(regex, "");
    var regex = /(##es##)/ig
    str = str.replace(regex, "");
    var regex = /(##\/en##)/ig
    str = str.replace(regex, " ");
    var regex = /(##\/es##)/ig
    str = str.replace(regex, " ");

    //console.log("before: \"" + s + "\" after :\"" + str + "\"")
    return str;
}

// todo: use the guard variable to check if the current record should be exported
ipcMain.on('exportForm', function (event, data) {
    writeLog("save now form : " + data['form'] + " " + data['filename']);
    var filename = data['filename'];
    var form = data['form'];
    if (typeof filename == 'undefined' || filename == '') {
        return; // ignore this request if we don't have a filename to save to
    }
    // what is the name of this instrument?
    var form_name = instrumentLabels[form];
    var v = store.get('instrument-' + form);
    if (typeof v !== 'undefined') {
        form_name = v;
    }

    tagstore = store.store; // update the tagstore for the next operation

    // if we have a restrictToNDADD defined we should export only stuff that fits with this data dictionary (remove columns that are wrong)
    if (restrictToNDA.length > 0) {
        // use the short name for the data dictionary
        form_name = restrictToNDA + ',01';
        // we don't know the version number - always assume its user defined
    }

    // structure of the data dictionary is:
    // ElementName
    // DataType
    // Size
    // Required
    // ElementDescription
    // ValueRange NDAR*, 0 :: 1260, Asian; Hawaiian or Pacitic Islander; Black, 0::174, 0::20; 999 1;2
    // Notes
    // Aliases
    str = form_name + "\n"; //data['form'] + ",01";
    str = str + "ElementName,DataType,Size,Required,Condition,ElementDescription,ValueRange,Notes,Aliases\n";
    str = str + "subjectkey,GUID,,Required,,The NDAR Global Unique Identifier (GUID) for research subject,NDAR*,,\n";
    str = str + "eventname,String,60,Required,,The event name for which the data was collected,,,\n";
    var lastGoodLabel = '';
    var missingItems = [];
    for (var i = 0; i < datadictionary.length; i++) {
        var d = datadictionary[i];
        if (d['form_name'] == data['form']) {

            if (restrictToNDA.length > 0) {
                // check if this item is in the allowed export list
                found = false;
                var na = d['field_name'];
                na = na.split('___')[0];
                for (var j = 0; j < restrictToNDADD['dataElements'].length; j++) {
                    // we could have underscores in there as well
                    var name = restrictToNDADD['dataElements'][j]['name'];
                    name = name.split('___')[0];
                    if (na == name) {
                        found = true;
                        break;
                    }
                    // check for translations as well
                    for (var k = 0; k < restrictToNDADD['dataElements'][j]['aliases'].length; k++) {
                        var naa = restrictToNDADD['dataElements'][j]['aliases'][k];
                        naa = naa.split('___')[0];
                        if (naa == na) {
                            found = true;
                            break;
                        }
                    }
                    if (found)
                        break;
                }
                if (!found) {
                    if (missingItems.indexOf(d['field_name']) < 0) {
                        writeLog("Info: Missing item " + d['field_name'] + " in NDA data dictionary " + restrictToNDA + ". Item will not be exported.");
                        missingItems.push(d['field_name']);
                    }
                    continue;
                }
            }

            //console.log("item is: " + Object.keys(d));
            var size = "30"; // default, could be 60 or 200 as well
            var type = "String";
            var range = "";
            var notes = "";
            notes = notes + (d['field_note'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_note']) : "");
            notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");

            var condition = ''
            if (typeof d['branching_logic'] !== 'undefined' && d['branching_logic'] !== '') {
                condition = d['branching_logic']
                var s = condition;
                // normalize the condition field to resemble javascript
                var re = RegExp(/\(([0-9]*)\)/g);
                condition = condition.replace(re, "___$1");
                condition = condition.replace(/([^>|<])=/g, "$1 ==");
                condition = condition.replace(/\ and\ /g, " && ");
                condition = condition.replace(/\ or\ /g, " || ");
                re = RegExp(/\[([^\]]*)\]/g);
                //console.log("condition: first: " + s + " \"" + condition + "\" -> " + condition.replace(re, " $1 ") );
                condition = condition.replace(re, " $1 ");
            }

            var aliases = "";
            var foundIntegerRange = false;
            if (typeof d['text_validation_type_or_show_slider_number'] !== 'undefined') {
                if (d['text_validation_type_or_show_slider_number'] == "integer") {
                    type = "Integer";
                    size = "";
                    var mi = "";
                    if (typeof d['text_validation_min'] !== 'undefined' && d['text_validation_min'] !== '') {
                        mi = parseInt(d['text_validation_min']);
                    }
                    var ma = "";
                    if (typeof d['text_validation_max'] !== 'undefined' && d['text_validation_max'] !== '') {
                        ma = parseInt(d['text_validation_max']);
                    }
                    if (mi !== "" && ma !== "") {
                        range = mi + " :: " + ma;
                    }
                    foundIntegerRange = true; // can be empty
                } else if (d['text_validation_type_or_show_slider_number'] == "number") {
                    type = "Float";
                    size = "";
                    var mi = "";
                    if (typeof d['text_validation_min'] !== 'undefined' && d['text_validation_min'] !== '') {
                        mi = parseFloat(d['text_validation_min']);
                    }
                    var ma = "";
                    if (typeof d['text_validation_max'] !== 'undefined' && d['text_validation_max'] !== '') {
                        ma = parseFloat(d['text_validation_max']);
                    }
                    if (mi !== "" && ma !== "") {
                        range = mi + " :: " + ma;
                    }
                    foundIntegerRange = true; // can be empty
                }
                if (d['text_validation_type_or_show_slider_number'] == "datetime_dmy") {
                    type = "Date";
                }
            }
            if (d['field_type'] == "radio" || d['field_type'] == "dropdown") {
                // overwrite the notes with the coding for this entry
                var choices = d['select_choices_or_calculations'].split("|");
                notes = "";
                range = "";
                type = "Integer";
                size = "";
                for (var j = 0; j < choices.length; j++) {
                    var bla = choices[j].split(",");
                    if (typeof bla[1] === 'undefined') {
                        notes = notes + bla[0].trim();
                    } else {
                        notes = notes + bla[0].trim() + " = " + unHTML(bla[1]);
                    }
                    range = range + bla[0].trim();
                    if (j < choices.length - 1) {
                        notes = notes + "; ";
                        range = range + " ; ";
                    }
                }
                notes = notes + (d['field_note'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_note']) : "");
                notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");
            }
            if (d['field_type'] == "number") {
                type = "Float";
                size = "";
            }
            if (d['field_type'] == "calc") {
                type = "Float";
                size = "";
                notes = "Calculation: " + d['select_choices_or_calculations'];
                notes = notes + (d['field_note'].length > 0 ? " | " + unHTML(d['field_note']) : "");
                notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");
            }
            if (d['field_type'] == "yesno") {
                range = "\"0 ; 1\"";
                notes = "1 = Yes; 0 = No"
                type = "Integer";
                size = "";
                notes = notes + (d['field_note'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_note']) : "");
                notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");
            }
            if (d['field_type'] == "text" && !foundIntegerRange) {
                type = "String";
            }
            if (d['field_type'] == "descriptive") {
                type = "String";
                notes = "Descriptive field";
                notes = notes + (d['field_note'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_note']) : "");
                notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");
                var label = d['field_label'];
                label = unHTML(label);
                label = label.replace(/\"/g, "\"\"");
                label = label.replace(/\r\n/g, "\n");
                if (label.trim() !== '')
                    lastGoodLabel = label;
                // NDA will not take any descriptive fields - only data can be exported
                writeLog("Remove column for item " + d['field_name'] + " (descriptive field).");
                continue;
            }
            if (d['field_type'] == "notes") {
                type = "String";
                size = "400";
                var label = d['field_label'];
                label = unHTML(label);
                label = label.replace(/\"/g, "\"\"");
                label = label.replace(/\r\n/g, "\n");
                if (label.trim() !== '')
                    lastGoodLabel = label;
                continue; // don't export
            }
            //console.log("Don't export completeness item: " + form + "_complete");
            if (d['field_label'] === form + "_complete") {
                //console.log("Don't export completeness item: " + d['field_label']);
                continue; // ignore the item that contains the completeness information
            }
            if (type == "String" && size == '') {
                size = "30"; // default value
            }
            // check if we have a longer flag for this field_name
            var flags = undefined; // = store.get('tag-' + d['field_name']);
            if (typeof tagstore['tag-' + d['field_name']] !== 'undefined')
                flags = tagstore['tag-' + d['field_name']];
            var flag_date = false; // do we have a date to parse?
            var flag_recommended = false; // should this field be recommended instead of conditional?
            if (typeof flags !== 'undefined') {
                if (flags.indexOf('remove') !== -1) {
                    writeLog("Remove column for item " + d['field_name']);
                    continue; // ignore this entry in the data dictionary
                }
                if (flags.indexOf('recommended') !== -1)
                    flag_recommended = true; // maybe we don't want to have a condition mentioned here, make those recommended
                if (flags.indexOf('long') !== -1)
                    size = "60"
                if (flags.indexOf('huge') !== -1)
                    size = "200"
                if (flags.indexOf('date') !== -1)
                    flag_date = true;
                if (flags.indexOf('label') !== -1) {
                    // in this case we will export the entries as strings (assuming that 30 characters are sufficient...)
                    type = "String"; // should not be exported as checkbox with values
                }
                if (flags.indexOf('clearcheckboxes') !== -1) {
                    // nothing needs to be done in the data dictionary
                }
                // if the branching logic referrs to entries that are outside the current instrument, NDA data uploads will fail
                if (flags.indexOf('branching2notes') !== -1) { // copy the conditional logic to the notes section
                    notes = notes + " Branching logic: " + condition;
                    notes = notes.trim();
                    condition = "";
                }
                if (flags.indexOf('alias') !== -1) { // copy the conditional logic to the notes section
                    var vv = undefined; // = store.get('alias-' + d['field_name']); // do we have a date field here instead of a string?            
                    if (typeof tagstore['alias-' + d['field_name']] !== 'undefined')
                        vv = tagstore['alias-' + d['field_name']]
                    // make sure we have an array here
                    if (typeof vv === 'string')
                        vv = vv.split(" ");
                    if (typeof vv !== 'undefined') { // add an alias to the data dictionary
                        aliases = (aliases + " " + vv.join(" ")).trim();
                    }
                }
            }
            if (flag_date) { // if we should parse a date we also need the parse string (stored in the parse- variable)
                var vv = undefined; // = store.get('parse-' + d['field_name']); // do we have a date field here instead of a string?            
                if (typeof tagstore['parse-' + d['field_name']] !== 'undefined')
                    vv = tagstore['parse-' + d['field_name']];
                if (typeof vv !== 'undefined') { // conversion to date requested
                    type = "Date";
                    size = "";
                }
            } // otherwise we ignore the date parsing

            var label = d['field_label'];
            // NDA does not want to have our nice color and language feature, instead they
            // want good old text fields. Lets ask jQuery for the text representation of this html.
            label = unHTML(label);
            // TODO: no solution for this yet:
            //   This will not work for math stuff like : bla <= 5, blub > 42

            //label = label.replace(/\&nbsp\;/g, "")

            label = label.replace(/\"/g, "\"\"");
            label = label.replace(/\r\n/g, "\n");
            if (label.trim() !== '')
                lastGoodLabel = label;
            //label = label.replace(/,/g,"\",\"");
            notes = notes.replace(/\"/g, "\"\"");
            notes = notes.replace(/\r\n/g, "\n");
            //notes = notes.replace(/,/g,"\",\"");
            condition = condition.replace(/\"/g, "\"\"");
            condition = condition.replace(/\r\n/g, "\n");
            condition = condition.replace(/\r/g, "");

            // if the description field is empty we should look at the previous items and 
            // copy its description over to this entry. The descriptions are likely to be
            // shared.
            if (label.trim() === "")
                label = "(r) " + lastGoodLabel;

            if (removeAnyText) {
                // this global flag indicates if normal text fields should be removed from the export
                // a normal text field is a text field that is not a date/number/integer
                if (d['field_type'] == "text" && d['text_validation_type_or_show_slider_number'] == '') {
                    writeLog("Warning: removed field " + d['field_name'] + " because its type text without validation.");
                    continue;
                }
            }

            // NDA might not like these entries if only a single choice has been selected (should be a radio button type)
            if (d['field_type'] == "checkbox") { // create separate entries for each of these
                var choices = d['select_choices_or_calculations'].split("|");
                range = "0 ; 1";
                notes = "0 = No; 1 = Yes";
                notes = notes + (d['field_note'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_note']) : "");
                notes = notes + (d['field_annotation'].length > 0 ? (notes.length > 0 ? " | " : "") + unHTML(d['field_annotation']) : "");
                type = "Integer";
                size = '';
                for (var j = 0; j < choices.length; j++) {
                    var parts = choices[j].split(",");
                    parts[0] = parts[0].trim();
                    parts[1] = parts.slice(1).join(", ");
                    var sanitized_choice = parts[0] + ", " + unHTML(parts[1]);
                    str = str + d['field_name'] + "___" + (parts[0]) + "," +
                        type + "," +
                        size + "," +
                        ((condition !== '' && !flag_recommended) ? "Conditional" : "Recommended") + "," +
                        condition + "," +
                        "\"" + label + " (" + sanitized_choice + ")\"," +
                        range + "," +
                        "\"" + notes + "\"," +
                        aliases + "\n";
                }
            } else {
                if (range == "0 :: 1") {
                    console.log("0::1: with " + type + d['field_type']);
                }
                str = str + d['field_name'] + "," +
                    type + "," +
                    size + "," +
                    ((condition !== '' && !flag_recommended) ? "Conditional" : "Recommended") + "," +
                    condition + "," +
                    "\"" + label + "\"," +
                    range + "," +
                    "\"" + notes + "\"," +
                    aliases + "\n";
            }
        }
    }
    if (restrictToNDA.length != 0)
        writeLog("Total number of missing items in NDA dictionary: " + missingItems.length);

    fs.writeFile(filename, str, function (err) {
        if (err) {
            writeLog(err);
            return;
        }
        writeLog("The file was saved...");
    });
});



function updateInstrumentList(event) {
    if (typeof instrumentLabels === 'undefined') {
        setTimeout(function () {
            updateInstrumentList(event);
        }, 2000);
        return; // do nothing
    }

    // filter instruments instruments by event
    var instruments = [];
    var inst = Object.keys(instrumentLabels);

    for (var i = 0; i < instrumentEventMapping.length; i++) {
        if (instrumentEventMapping[i]['unique_event_name'] == event || event == "ALL") {
            // what is the correct name for this event?
            var instrument = instrumentEventMapping[i]['form'];
            var name = instrumentLabels[instrument];
            if (typeof name == 'undefined') {
                name = ""; // default name is empty string
            }
            var found = false;
            for (var j = 0; j < instruments.length; j++) {
                if (instruments[j][0] == instrument) {
                    found = true;
                }
            }
            if (!found)
                instruments.push([instrument, name]);
        }
    }

    win.send('updateInstrumentList', instruments);
}

function getEvents(token) {
    var data = {
        'token': token,
        'content': 'event',
        'format': 'json',
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = current_url;
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            writeLog("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response));
            return;
        }
        setTimeout(function () {
            setupDialog.send('eventsFromREDCap', body);
            allEvents = body;
        }, 1000); // we might not have all the data here yet... 
    });
}

function getInstrumentEventMapping(token) {
    instrumentEventMapping = {};
    var data = {
        'token': token,
        'content': 'formEventMapping',
        'format': 'json',
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = current_url;
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            writeLog("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response));
            return;
        }
        instrumentEventMapping = body;
    });
}

function getDataDictionary(token) {
    var data = {
        'token': token,
        'content': 'metadata',
        'format': 'json',
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = "https://abcd-rc.ucsd.edu/redcap/api/";
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            writeLog("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response));
            return;
        }

        datadictionary = [];
        // we should remove entries in the data dictionary that are HIDDEN
        // field_annotation == @HIDDEN
        for (var e in body) {
            entry = body[e];
            // skip values that are hidden
            if (typeof entry['field_annotation'] !== 'undefined' && entry['field_annotation'].indexOf("@HIDDEN") !== -1 && entry['field_annotation'].indexOf("@SHARED") === -1) {
                continue;
            }
            datadictionary.push(entry);
        }

        // get list of instruments
        instruments = {};
        for (var entry in datadictionary) {
            if (datadictionary[entry]['field_type'] == 'descriptive')
                continue;
            if (datadictionary[entry]['field_type'] == 'notes')
                continue;
            var matches = null;
            if (typeof datadictionary[entry]['field_annotation'] !== 'undefined') {
                // find out if we have a date attached to the HIDEFROMCOMPLETION field
                matches = datadictionary[entry]['field_annotation'].match(/HIDEFROMCOMPLETION(\d{4})(\d{2})(\d{2})/);
                if (matches !== null) {
                    //console.log(" HIDEFROMCOMPLETION FOUND WITH DATE! " + JSON.stringify(matches) + " for " + datadictionary[entry]['field_annotation'] + " " + JSON.stringify(datadictionary[entry]));
                } else { // we could still have a HIDEFROMCOMPLETION without a date here
                    if (datadictionary[entry]['field_annotation'].indexOf("HIDEFROMCOMPLETION") !== -1)
                        continue;
                }
            }
            if (datadictionary[entry]['field_name'] == "permission_school_records" || datadictionary[entry]['field_name'] == "permission_teacher_contact")
                continue;
            // if a variable is of type checkbox we have to replace it with the list of possible entries from the choices column
            // any one entry filled out would make this work
            var numChoices = [];
            if (datadictionary[entry]['field_type'] == 'checkbox') {
                // find out how many choices there are
                var choices = datadictionary[entry]['select_choices_or_calculations'].split("|");
                for (var i = 0; i < choices.length; i++) {
                    var c = choices[i].trim().split(",")[0].trim();
                    numChoices.push(c);
                }
            }
            if (typeof instruments[datadictionary[entry]['form_name']] == 'undefined')
                instruments[datadictionary[entry]['form_name']] = [];
            instruments[datadictionary[entry]['form_name']].push([datadictionary[entry]['field_name'],
                datadictionary[entry]['branching_logic'],
                numChoices,
                matches !== null ? matches[1] + "-" + matches[2] + "-" + matches[3] : null
            ]);
        }
        getNamesForInstrument(token);
        //process.stdout.write("Done with getting data dictionary...\n" + JSON.stringify(instruments));
    });
}

function getNamesForInstrument(token) {
    instrumentLabels = {};

    var data = {
        'token': token,
        'content': 'instrument',
        'format': 'json',
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = "https://abcd-rc.ucsd.edu/redcap/api/";
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            return;
        }
        var data = body;
        for (var entry in data) {
            instrumentLabels[data[entry]['instrument_name']] = data[entry]['instrument_label'];
        }
        writeLog("found " + Object.keys(instrumentLabels).length + " instruments");
        // filterDataDictionary( tokens ); // remove entries from instruments again that are not part of the baseline event

        //setupDialog.send('eventsFromREDCap', "DATA FROM REDCAP 1 ");        
    });
}

function filterDataDictionary(token) {

    var data = {
        'token': token,
        'content': 'formEventMapping',
        'format': 'json',
        'returnFormat': 'json'
    }

    var headers = {
        'User-Agent': 'Super Agent/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    var url = "https://abcd-rc.ucsd.edu/redcap/api/";
    request({
        method: 'POST',
        url: url,
        form: data,
        headers: headers,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            // error case
            process.stdout.write("ERROR: could not get a response back from redcap " + error + " " + JSON.stringify(response) + "\n");
            return;
        }
        data = body;
        writeLog("number of instruments before filering: " + Object.keys(instruments).length);

        // filter out instruments that are not in the baseline event
        var okforms = [];
        for (var d in data) {
            writeLog("Check event name: " + data[d]['unique_event_name'] + " for: " + data[d]['form']);
            if (data[d]['unique_event_name'] == timepoint /*'baseline_year_1_arm_1' */ ) {
                okforms.push(data[d]['form']);
            }
        }
        writeLog("instruments to keep are: " + okforms.length + "\n" + JSON.stringify(okforms));

        for (var d in instruments) {
            if (okforms.indexOf(d) === -1) {
                writeLog("remove the form: " + d);
                delete instruments[d];
            } else {
                writeLog("Keep form: " + d);
            }
        }
        writeLog("number of instruments left: " + Object.keys(instruments).length);
    });
}
