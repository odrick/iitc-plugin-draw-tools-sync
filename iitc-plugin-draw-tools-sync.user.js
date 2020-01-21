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


////////////// Default storage - Google Drive ////////////////
function GoogleDriveStorage(clientId, scope) {
    this.clientId = clientId;
    this.scope = scope;

    this.authorized = false;
}

GoogleDriveStorage.prototype.init = function(callback) {
    $.getScript('https://apis.google.com/js/api.js').done(function () {
        gapi.load('client:auth2', callback);
    });
};

GoogleDriveStorage.prototype.authorize = function(redirect, callback) {
    this.authorized = false;

    var self = this;

    function handleAuthResult(authResult) {
        if(authResult && !authResult.error) {
            self.authorized = true;
        }
        else {
            self.authorized = false;
            var error = (authResult && authResult.error) ? authResult.error : 'not authorized';
            console.log(error);
            if(error === "idpiframe_initialization_failed") {
                console.log('You need enable 3rd-party cookies in your browser or allow [*.]google.com');
            }
        }

        if(callback) callback(self.authorized);
    }

    gapi.auth2.init({
        client_id: this.clientId,
        scope: this.scope,
        ux_mode: 'redirect',
        redirect_uri: 'https://intel.ingress.com'
    }).then(function() {
        var isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();

        if(isSignedIn) {
            self.authorized = true;
            if(callback) callback(self.authorized);
        }
        else {
            self.authorized = false;

            if(redirect) {
                gapi.auth2.getAuthInstance().signIn().then(handleAuthResult);
            }
            else {
                if(callback) callback(self.authorized);
            }
        }
    }, handleAuthResult);
};

GoogleDriveStorage.prototype.signOut = function(callback) {
    var auth2 = gapi.auth2.getAuthInstance();
    var self = this;
    auth2.signOut().then(function () {
        auth2.disconnect();
        self.authorized = false;
        if(callback) callback();
    });
};

GoogleDriveStorage.prototype.getFilesList = function(callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
            orderBy: 'modifiedTime'
        }).then(function(resp) {
            if(callback) callback(resp.result.files);
        });
    });
};

GoogleDriveStorage.prototype.findFile = function(name, callback) {
    this.getFilesList(function(list) {
        var found = null;

        for(var i=0; i<list.length; i++) {
            var file = list[i];
            if(file.name.toLowerCase() === name.toLowerCase()) found = file;
        }

        if(callback) callback(found);
    });
};

GoogleDriveStorage.prototype.createFile = function(name, callback) {
    this.findFile(name, function(file) {
        if(file) {
            if(callback) callback(file);
            return;
        }

        gapi.client.load('drive', 'v3').then(function() {
            gapi.client.drive.files.create({
                resource: {
                    name: name,
                    mimeType: 'text/plain',
                    parents: ['appDataFolder']
                },
                fields: 'id,name'
            }).then(function(resp) {
                if(callback) callback(resp.result);
            });
        });
    });
};

GoogleDriveStorage.prototype.readFile = function(id, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.get({fileId: id, alt: 'media'}).then(function(resp) {
            console.log('File loaded', resp);
            if(callback) callback(resp);
        });
    });
};

GoogleDriveStorage.prototype.saveFileById = function(id, content, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.request({
            path: '/upload/drive/v3/files/' + id,
            method: 'PATCH',
            params: {uploadType: 'media'},
            body: content
        }).then(function(resp) {
            console.log('File saved', resp);
            if(callback) callback(resp);
        });
    });
};

GoogleDriveStorage.prototype.saveFileByName = function(name, content, callback) {
    var self = this;

    self.findFile(name, function(file) {
        console.log("found", file);

        if(file) {
            self.saveFileById(file.id, content, callback);
        }
        else {
            self.createFile(name, function(file) {
                self.saveFileById(file.id, content, callback);
            });
        }
    });
};

GoogleDriveStorage.prototype.deleteFile = function(id, callback) {
    gapi.client.load('drive', 'v3').then(function() {
        gapi.client.drive.files.delete({fileId: id}).then(function() {
            console.log('File deleted');
            if(callback) callback();
        });
    });
};

//////////////////////////////////////////////////////////////

var CLIENT_ID = '850036042257-lps5dks8a2274cmdtab87bpksh2mr3m6.apps.googleusercontent.com';
var SCOPE = 'https://www.googleapis.com/auth/drive.appfolder';

var dataStorage = null;
var ready = false;
var dataFileExt = 'dtd';

function fixDataFileName(name) {
    var parts = name.split('.');
    if(parts.length < 2 || parts.pop() !== dataFileExt) {
        name = name + '.' + dataFileExt;
    }
    return name;
}

function setup() {
    dataStorage = new GoogleDriveStorage(CLIENT_ID, SCOPE);
    window.plugin.drawToolsSync.dataStorage = dataStorage;

    dataStorage.init(function() {
        dataStorage.authorize(false, function(authorized) {
            console.log("Authorized status:", authorized);
            ready = true;
        });
    });

    window.plugin.drawToolsSync.isReady = function() {
        return !!(window.plugin.drawTools && ready);
    };

    window.plugin.drawToolsSync.getFilesList = function(callback) {
        dataStorage.getFilesList(function(res) {
            var list = [];
            for(var i=0; i<res.length; i++) {
                var file = res[i];
                var parts = file.name.split('.');
                if(parts.pop() === dataFileExt) {
                    list.push({
                        id: file.id,
                        name: parts.join('.')
                    });
                }
            }
            if(callback) callback(list);
        });
    };

    window.plugin.drawToolsSync.saveFile = function(name, callback) {
        var data = localStorage['plugin-draw-tools-layer'];
        if(!data) {
            alert('Draw tools data is empty');
            return;
        }

        dataStorage.saveFileByName(fixDataFileName(name), data, callback);
    };

    window.plugin.drawToolsSync.loadFile = function(name, callback) {
        dataStorage.findFile(fixDataFileName(name), function(file) {
            if(!file) {
                alert("File " + name + " not found");
                return;
            }

            dataStorage.readFile(file.id, function(data) {
                if(data && data.result) {
                    window.plugin.drawTools.import(data.result);
                    window.plugin.drawTools.save();
                }
                else {
                    alert("Error while loading file " + name);
                }

                if(callback) callback();
            });
        });
    };

    window.plugin.drawToolsSync.deleteFile = function(name, callback) {
        dataStorage.findFile(fixDataFileName(name), function(file) {
            if(!file) {
                alert("File " + name + " not found");
                return;
            }

            dataStorage.deleteFile(file.id, callback);
        });
    };
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