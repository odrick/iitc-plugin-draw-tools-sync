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

// use own namespace for plugin
window.plugin.drawToolsSync = function() {};

window.plugin.drawToolsSync.authorizer = null;

window.plugin.drawToolsSync.Authorizer = function(options) {
  this.authCallback = options.authCallback;
  this.authorizing = false;
  this.authorized = false;
  this.isAuthed = this.isAuthed.bind(this);
  this.isAuthorizing = this.isAuthorizing.bind(this);
  this.authorize = this.authorize.bind(this);
};

window.plugin.drawToolsSync.Authorizer.prototype.CLIENT_ID = '850036042257-lps5dks8a2274cmdtab87bpksh2mr3m6.apps.googleusercontent.com';
window.plugin.drawToolsSync.Authorizer.prototype.SCOPES = 'https://www.googleapis.com/auth/drive.file';

window.plugin.drawToolsSync.Authorizer.prototype.isAuthed = function() {
  return this.authorized;
};

window.plugin.drawToolsSync.Authorizer.prototype.isAuthorizing = function() {
  return this.authorizing;
};
window.plugin.drawToolsSync.Authorizer.prototype.addAuthCallback = function(callback) {
  if(typeof(this.authCallback) === 'function') this.authCallback = [this.authCallback];
  this.authCallback.push(callback);
};

window.plugin.drawToolsSync.Authorizer.prototype.authComplete = function() {
  debugger
  this.authorizing = false;
  if(this.authCallback) {
    if(typeof(this.authCallback) === 'function') this.authCallback();
    if(this.authCallback instanceof Array && this.authCallback.length > 0) {
      $.each(this.authCallback, function(ind, func) {
        func();
      });
    }
  }
};

window.plugin.drawToolsSync.Authorizer.prototype.authorize = function(redirect) {
  this.authorizing = true;
  this.authorized = false;
  var handleAuthResult, _this;
  _this = this;

  handleAuthResult = function(authResult) {
    console.log("TEST", authResult);
    if(authResult && !authResult.error) {
      _this.authorized = true;
      console.log('All ok');
    } else {
      _this.authorized = false;
      var error = (authResult && authResult.error) ? authResult.error : 'not authorized';
      console.log(error);
      if (error === "idpiframe_initialization_failed") {
        console.log('You need enable 3rd-party cookies in your browser or allow [*.]google.com');
      }
    }
    _this.authComplete();
  };

  var GoogleAuth;
  gapi.auth2.init({
    'client_id': this.CLIENT_ID,
    'scope': this.SCOPES,
    ux_mode: 'redirect',
    redirect_uri: 'https://intel.ingress.com/'
  }).then(function() {
    
    GoogleAuth = gapi.auth2.getAuthInstance();
    var isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();

    if(isSignedIn) {
      _this.authorized = true;
      console.log('Authorized');

    } else {
      _this.authorized = false;

      if (redirect) {
        GoogleAuth.signIn().then(handleAuthResult);
      }
    }
    _this.authComplete();
    
  }, handleAuthResult);
};

var setup = function() {
  window.plugin.drawToolsSync.authorizer = new window.plugin.drawToolsSync.Authorizer({
    'authCallback': [function() {console.log('Auth callback', arguments)}]
  });

  var GOOGLEAPI = 'https://apis.google.com/js/api.js';
  $.getScript(GOOGLEAPI).done(function () {
    gapi.load('client:auth2', window.plugin.drawToolsSync.authorizer.authorize);
  });
};

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
 