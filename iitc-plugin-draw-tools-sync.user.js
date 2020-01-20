// ==UserScript==
// @author         Odrick
// @name           IITC plugin: Draw Tools Sync
// @category       Misc
// @version        0.0.1
// @description    Sync draw tools data between clients via Google Drive API.
// @id             draw-tools-sync
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {

if(typeof window.plugin !== 'function') window.plugin = function() {};

plugin_info.buildName = '0.0.1';
plugin_info.dateTimeVersion = '2020-01-20-162932';
plugin_info.pluginId = 'draw-tools-sync';

window.plugin.drawToolsSync = function() {};

var CLIENT_ID = '850036042257-lps5dks8a2274cmdtab87bpksh2mr3m6.apps.googleusercontent.com';
var SCOPE = 'https://www.googleapis.com/auth/drive.appfolder';
var AUTHORIZED = false;
var DATA_FILE_NAME = "IITC_DRAW_TOOLS_SYNC.json";
var DATA_FILE_ID = '';
var DATA = {'default': ''};

function authorize(redirect, callback) {
    AUTHORIZED = false;

    function handleAuthResult(authResult) {
        if(authResult && !authResult.error) {
            AUTHORIZED = true;
            init(callback);
        }
        else {
            AUTHORIZED = false;
            var error = (authResult && authResult.error) ? authResult.error : 'not authorized';
            console.log(error);
            if(error === "idpiframe_initialization_failed") {
                console.log('You need enable 3rd-party cookies in your browser or allow [*.]google.com');
            }
            if(callback) callback();
        }
    }

    gapi.auth2.init({client_id: CLIENT_ID, scope: SCOPE, ux_mode: 'redirect', redirect_uri: 'https://intel.ingress.com'}).then(function() {
        var isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();

        if(isSignedIn) {
            AUTHORIZED = true;
            init(callback);
        }
        else {
            AUTHORIZED = false;

            if(redirect) {
                gapi.auth2.getAuthInstance().signIn().then(handleAuthResult);
            }
            else {
                if(callback) callback();
            }
        }
    }, handleAuthResult);
}

function init(callback) {
    DATA = {'default': ''};

    getDataFileInfo(function(info) {
        console.log('data file info', info);
        if(info) {
            DATA_FILE_ID = info.id;
        }
        else {
            createDataFile(callback);
        }
    });
}

function getDataFileInfo(callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
            orderBy: 'createdTime'
        }).then(function(resp) {
            if(callback) callback(resp.result.files[0]);
        });
    });
}

function createDataFile(callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.create({
            resource: {
                name: DATA_FILE_NAME,
                mimeType: 'application/json',
                parents: ['appDataFolder']
            },
            fields: 'id'
        }).then(function(resp) {
            DATA_FILE_ID = resp.result.id;
            if(callback) callback();
        });
    });
}

function readFile(id, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.get({fileId: id, alt: 'media'}).then(function(resp) {
            console.log(resp);
        });
    });
}

function saveFile(id, content, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.request({
            path: '/upload/drive/v3/files/' + id,
            method: 'PATCH',
            params: {uploadType: 'media'},
            body: typeof content === 'string' ? content : JSON.stringify(content)
        }).then(function(resp) {
            console.log(resp);
        });
    });
}

function deleteFile(id, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.delete({fileId: id}).then(function() {
            console.log('File deleted');
            if(callback) callback();
        });
    });
}

function signOut(callback) {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
        auth2.disconnect();
        if(callback) callback();
    });
}

function setup() {
    window.plugin.drawToolsSync.authorize = authorize;
    window.plugin.drawToolsSync.signOut = signOut;
    window.plugin.drawToolsSync.getDataFileInfo = getDataFileInfo;
    window.plugin.drawToolsSync.createDataFile = createDataFile;
    window.plugin.drawToolsSync.deleteFile = deleteFile;
    window.plugin.drawToolsSync.readFile = readFile;
    window.plugin.drawToolsSync.saveFile = saveFile;

    $.getScript('https://apis.google.com/js/api.js').done(function () {
        gapi.load('client:auth2', window.plugin.drawToolsSync.authorize);
    });
}

setup.priority = 'high';

setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
