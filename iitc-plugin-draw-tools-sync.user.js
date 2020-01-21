// ==UserScript==
// @author         Odrick
// @name           IITC plugin: Draw Tools Sync
// @category       Draw
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

    function setupCSS() {
        //var css = '#spyAgentBox{display:none;position:absolute!important;z-index:5001;top:50px;left:70px;width:500px;height:450px;overflow:hidden;background:rgba(8,48,78,.9);border:1px solid #20a8b1;color:#ffce00;padding:8px}#spyAgentBox #topBar{height:15px!important}#spyAgentBox #topBar *{height:14px!important}#spyAgentBox .handle{width:89%;text-align:center;color:#fff;line-height:6px;cursor:move;float:right}#spyAgentBox #topBar .btn{display:block;width:10%;cursor:pointer;color:#20a8b1;font-weight:700;text-align:center;line-height:13px;font-size:18px;border:1px solid #20a8b1;float:left}#spyAgentBox #topBar .btn:hover{color:#ffce00;text-decoration:none}#spyAgentsList{background:#000;border:1px solid #20a8b1;color:#fff;height:20px;width:170px;margin-right:38px}#spyAgentHistory{background:#000;border:1px solid #20a8b1;color:#fff;height:20px;width:100px}#spyAgentControls{border-top:1px solid #20a8b1;border-bottom:1px solid #20a8b1;padding-top:4px;padding-bottom:4px;clear:both}#spyAgentStart{background:rgba(8,48,78,1);border:1px solid #20a8b1;color:#ffce00;height:20px}#spyAgentContent{width:100%;height:385px;overflow:auto;overflow-x:hidden;font-size:12px;border-bottom:1px solid #20a8b1}#spyAgentStatus{padding-top:8px;padding-bottom:4px;font-size:12px;color:#fff;float:left}#spyAgentsListContainer{padding-top:4px;padding-bottom:4px;font-size:12px;color:#fff;float:right}.spyAgentContentRow{color:#fff;white-space:nowrap}.spyAgentContentDate{color:#999}.spyAgentRESISTANCE{color:#08f}.spyAgentENLIGHTENED{color:#03dc03}#spyAgentDateSelector{text-align:center;color:#fff;padding:4px;border-bottom:1px solid #20a8b1;display:none}#spyAgentDateSelector button{background:rgba(8,48,78,1);border:1px solid #20a8b1;color:#ffce00;height:20px}';
        //$('<style>').prop('type', 'text/css').html(css).appendTo('head');
        $('<link rel="stylesheet" type="text/css" href="http://localhost/dt.css"/>').appendTo('head');
    }

    function setupUI() {
        var content = '';

        content += '<div id="drawToolsSyncBox">';
        content += '    <div id="drawToolsSyncTopBar">';
        content += '        <a id="drawToolsSyncMin" class="btn" onclick="window.plugin.drawToolsSync.hideBox();return false;" title="Minimize">-</a>';
        content += '        <div class="handle"><div id="drawToolsSyncTitle" class="ui-dialog-title ui-dialog-title-active">Status</div></div>';
        content += '    </div>';
        content += '    <div id="drawToolsSyncContent">';
        content += '        <div id="drawToolsSyncList"></div>';
        content += '        <div id="drawToolsSyncSavePanel"></div>';
        content += '    </div>';
        content += '    <div id="drawToolsSyncAuth"><a onclick="window.plugin.drawToolsSync.auth();return false;">Authorize</a></div>';
        content += '    <div id="drawToolsSyncLock"><svg width="50px" height="50px" viewBox="-103 -16 533 533.33333" xmlns="http://www.w3.org/2000/svg"><path fill="white" d="m293.167969 131.632812v-35.382812h5.222656c12.847656.035156 23.332031-10.269531 23.527344-23.113281v-49.988281c-.191407-12.851563-10.671875-23.164063-23.527344-23.148438h-280.449219c-12.855468-.015625-23.335937 10.296875-23.523437 23.148438v49.988281c.195312 12.84375 10.675781 23.148437 23.523437 23.113281h5.226563v35.382812c-.019531 16.757813 7.617187 32.605469 20.734375 43.03125l94.039062 75.183594-92.191406 71.511719c-13.496094 10.398437-21.386719 26.496094-21.332031 43.539063v38.851562h-6.476563c-12.847656-.035156-23.328125 10.269531-23.523437 23.113281v49.988281c.1875 12.851563 10.667969 23.164063 23.523437 23.148438h280.449219c12.855469.015625 23.335937-10.296875 23.527344-23.148438v-49.988281c-.195313-12.84375-10.679688-23.148437-23.527344-23.113281h-3.972656v-38.605469c-.078125-17.210937-8.140625-33.410156-21.824219-43.851562l-94.066406-71.542969 93.921875-75.089844c13.113281-10.425781 20.746093-26.277344 20.71875-43.027344zm-273.75-106.632812h277.5v46.25h-277.5zm277.5 450h-277.5v-46.25h15.34375c.71875 0 1.445312.203125 2.199219.203125.75 0 1.484374-.203125 2.203124-.203125h240.390626c.714843 0 1.449218.203125 2.199218.203125.753906 0 1.484375-.203125 2.199219-.203125h12.964844zm-27.5-109.855469v38.605469h-220v-38.851562c-.019531-9.3125 4.289062-18.105469 11.671875-23.785157l97.140625-75.351562 99.222656 75.425781c7.484375 5.703125 11.90625 14.550781 11.964844 23.957031zm-12.605469-210.007812-98.621094 78.859375-98.65625-78.859375c-7.179687-5.6875-11.367187-14.34375-11.367187-23.503907v-35.382812h220v35.382812c0 9.160157-4.179688 17.8125-11.355469 23.503907zm0 0"/></svg></div>';
        content += '</div>';

        $('body').append(content);
        $('#drawToolsSyncBox').draggable({handle: '.handle', containment: 'window'});

        if(!window.plugin.drawToolsSync.isSmart) {
            //Desktop mode
            $('#toolbox').append('<a onclick="window.plugin.drawToolsSync.showBox(0);return false;">DrawTools Load</a>');
            $('#toolbox').append('<a onclick="window.plugin.drawToolsSync.showBox(1);return false;">DrawTools Save</a>');
        }
        else {
            //Mobile mode
            if(window.useAndroidPanes()) android.addPane("plugin-draw-tools-sync-load", "DrawTools Load", "ic_action_star");
            if(window.useAndroidPanes()) android.addPane("plugin-draw-tools-sync-save", "DrawTools Save", "ic_action_star");
            window.addHook('paneChanged', function(pane) {
                if(pane === 'plugin-draw-tools-sync-load') {
                    showBox(0);
                }

                if(pane === 'plugin-draw-tools-sync-save') {
                    showBox(1);
                }
            });
        }
    }

    var refreshFilesListId = 0;

    function refreshFilesList(mode) {
        refreshFilesListId++;
        var currentRefresh = refreshFilesListId;

        showLock();

        window.plugin.drawToolsSync.getFilesList(function(list) {
            if(currentRefresh !== refreshFilesListId) return;

            $("#drawToolsSyncList").html("");

            /*
            var t = list.slice();
            for(var i=0; i<20; i++) {
                list = list.concat(t);
            }
            */

            for(var i=0; i<list.length; i++) {
                var file = list[i];
                if(mode === 0) {
                    $("#drawToolsSyncList").append("<div><a onclick='window.plugin.drawToolsSync.loadFile(\"" + file.name + "\")'>" + file.name + "</a></div>");
                }
            }

            hideLock();
        });
    }

    function showLock() {
        $("#drawToolsSyncLock").show();
    }

    function hideLock() {
        $("#drawToolsSyncLock").hide();
    }

    function showBox(mode) {
        if(!window.plugin.drawToolsSync.isReady()) return;

        var title = "";

        if(mode === 0) {
            title = "DrawTools Load";
        }
        else {
            title = "DrawTools Save";
        }

        $("#drawToolsSyncBox").show();
        $("#drawToolsSyncTitle").html(title);

        if(dataStorage.authorized) {
            $("#drawToolsSyncAuth").hide();
            $("#drawToolsSyncContent").show();

            refreshFilesList(mode);
        }
        else {
            $("#drawToolsSyncAuth").show();
            $("#drawToolsSyncContent").hide();
        }
    }

    function hideBox() {
        $("#drawToolsSyncBox").hide();
    }

    function setup() {
        if(!window.plugin.drawTools) return;

        setupCSS();
        setupUI();

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

        window.plugin.drawToolsSync.auth = function() {
            dataStorage.authorize(true);
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
            showLock();

            dataStorage.findFile(fixDataFileName(name), function(file) {
                hideLock();

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

        window.plugin.drawToolsSync.showBox = showBox;
        window.plugin.drawToolsSync.hideBox = hideBox;
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