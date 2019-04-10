/**
 *
 * benqbang adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "benqbang",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js benqbang Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@benqbang.com>"
 *          ]
 *          "desc":         "benqbang adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "materialize":  true,                       // support of admin3
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42,
 *          "mySelect": "auto"
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const prettyMs = require('pretty-ms');
const path = require('path');
const util = require('util');
const http = require('http');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.benqbang.0
const adapter = new utils.Adapter('benqbang');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

adapter.on('stateChange', function (id, state) {
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    if (!id || !state || state.ack) {
        return;
    }
    var l = id.split('.');
    if (l.length != 4) {
        adapter.info('what are you trying to set in ' + id + '???');
        return;
    }
    adapter.getState('power',(err, id) => {
        resetStates();            
        if (l[3] == 'power_on') {
            if(id.val == false) {
                setPowerOn();
            }
        }else if (l[3] == 'power_off') {
            if(id.val == true) {
                setPowerOff();
            }
        }
    });
});

function setState(obj_name, name, role, type, val) {
    adapter.getObject(obj_name, function(err, obj) { 
        if (!obj) {
            adapter.setObject(obj_name, {
            type: 'state',
            common: {
                name: name,
                role: role,
                type: type,
                read: true,
                write: false,
            },
            native: {}
            });
        }
    });
    adapter.setStateChanged(obj_name, { val: val, ack: true});
}

function setPowerState(val) {
    setState('power', 'projector power', 'indicator' , 'bool', val);
}

function queryResult(callback) {
    setTimeout(() => {
        http.get('http://' + adapter.config.server + '/result', (resp) => {
            let data = '';
            
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                var result = {}
                try {
                    result = JSON.parse(data);
                } catch(error) {
                    console.log(error);
                }
                
                callback(result);
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            setPowerState(false);
        });
    }, 1*1000);
}

function queryPowerState() {
    http.get('http://' + adapter.config.server + '/cmd?modelname', (resp) => {
        let data = '';
        
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            queryResult((result) => {
                try {
                    var g = />.*\*[a-zA-Z]+ *= *\?\#[\s]*\*([a-zA-Z]+) *=([0-9a-zA-Z]+)/.exec(result.result);
                    console.log(g[1] + ' = ' + g[2]);
                    setPowerState(true);
                    setState('modelname', 'projector model name', '' , 'text', g[2]);
                } catch(error) {
                    console.log(error);
                    setPowerState(false);
                }
                setTimeout(process, 5*1000);
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function setPowerOn() {
    http.get('http://' + adapter.config.server + '/cmd?poweron', (resp) => {
        let data = '';
        
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            queryResult((result) => {
                try {
                    var g = />.*\*[a-zA-Z]+ *= *\?\#[\s]*\*([a-zA-Z]+) *=([0-9a-zA-Z]+)/.exec(result.result);
                    console.log(g[1] + ' = ' + g[2]);
                    setState('last_result', 'last projector result', '' , 'text', g[0]);
                } catch(error) {
                    console.log(error);
                    setState('last_result', 'last projector result', '' , 'text', '');
                }
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function setPowerOff() {
    http.get('http://' + adapter.config.server + '/cmd?poweroff', (resp) => {
        let data = '';
        
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
        
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            queryResult((result) => {
                try {
                    var g = />.*\*[a-zA-Z]+ *= *\?\#[\s]*\*([a-zA-Z]+) *=([0-9a-zA-Z]+)/.exec(result.result);
                    console.log(g[1] + ' = ' + g[2]);
                    setState('last_result', 'last projector result', '' , 'text', g[0]);
                } catch(error) {
                    console.log(error);
                    setState('last_result', 'last projector result', '' , 'text', '');
                }
            });
        });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

function process() {
    if (adapter.config.server) {
        http.get('http://' + adapter.config.server + '/alive', (resp) => {
            let data = '';
            
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });
            
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                var alive = JSON.parse(data);
                console.log(alive);
                queryPowerState();
                setState('alive', 'server alive', 'indicator' , 'number', alive.alive);
            });
        }).on("error", (err) => {
            console.log("Error: " + err.message);
        });
    }
}

function resetStates() {
    setState('commands.power_on', 'set projector power on', 'switch' , 'bool', false);
    setState('commands.power_off', 'set projector power off', 'switch' , 'bool', false);
}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('address of serial server: ' + adapter.config.ip);

    // in this all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    resetStates();
    process();
}
