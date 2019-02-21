var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");
const dialog = remote.dialog;


ipcRenderer.on('my-msg', function(arg) {
    console.log("the setupDialog got a message : " + arg);
});

ipcRenderer.on('eventsFromREDCap', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    jQuery('#setup-events-list').children().remove();
    jQuery('#setup-events-list').append('<option value="ALL">ALL</option>');
    for(var i = 0; i < data.length; i++) {
        jQuery('#setup-events-list').append('<option value="' + data[i]['unique_event_name'] + '">' + data[i]['event_name'] + "</option>");
    }
});

jQuery(document).ready(function() {

    jQuery('div.tab-item').click(function() {
        // make this one visible all others invisible
        jQuery('div.mytabs').hide();
        jQuery('div.tab-item').removeClass('active');
        jQuery(this).addClass('active');
        var a = jQuery(this).attr('target');
        jQuery('#' + a).show();
    });

    jQuery('#setup-dialog-ok').on('click', function() {
        // ok we have two modes here, either REDCap or Filesystem. What is highlighted?
        var mode = "REDCap";
        jQuery('div.tab-item').each(function() {
            if (jQuery(this).hasClass('active')) {
                mode = jQuery(this).attr('mode');
            }
        });
        if (typeof mode == 'undefined') {
            alert("Error: please submit on either the REDCap or Filesystem page to enabled that data method.");
            return false;
        }
        // set the input mode on the server
        ipcRenderer.send('setDataMode', { mode: mode });


        var token = jQuery('#redcap-access-token').val();
        var choice = jQuery('#setup-events-list').val();
        var url    = jQuery('#redcap-api-url').val(); // if no value is provided use ABCD
        if (url.trim() === "") {
            url = "https://abcd-rc.ucsd.edu/redcap/api/";
        }
        if (mode == "REDCap") {
            if (token == "" || choice == "" || choice == null || typeof choice == 'undefined') {
                alert("Error: please enter a token, press Update and select an event");
                return false;
            }
            ipcRenderer.send('closeSetupDialogOk', { token: token, event: choice, url: url, mode: mode } );
        } else if (mode == "filesystem") {
            // we ignore all events, just assume All
            ipcRenderer.send('closeSetupDialogFilesystemOk', { event: "All", mode: mode } );
        }
        return false;
    });
    jQuery('#nda-subject-json').on('click', function() {
        dialog.showOpenDialog({ properties: ['openFile'], extensions: ['json'], defaultPath: "subject_data.json" }, function (filename) {
            ipcRenderer.send('openLoadJSONDialog', { filename: filename });
            jQuery('#nda-subject-json-filename').text(filename);
        });        
        return false;
    });
    jQuery('#nda-subject-json2').on('click', function() {
        dialog.showOpenDialog({ properties: ['openFile'], extensions: ['json'], defaultPath: "subject_data.json" }, function (filename) {
            ipcRenderer.send('openLoadJSONDialog', { filename: filename });
            jQuery('#nda-subject-json-filename2').text(filename);
        });        
        return false;
    });

    jQuery('#nda-aliases').on('click', function() {
        dialog.showOpenDialog({ properties: ['openFile'], extensions: ['csv'], defaultPath: "aliases.csv" }, function (filename) {
            ipcRenderer.send('openLoadCSVDialog', { filename: filename });
            jQuery('#nda-aliases-filename').text(filename);
        });        
        return false;
    });

    jQuery('#specify-datadir').on('click', function() {
        dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: "~/" }, function (dirname) {
            ipcRenderer.send('parseFilesystemData', { dirname: dirname });
            jQuery('#datadir-filename').text(dirname);
        });        
        return false;
    });

    jQuery('#setup-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeSetupDialogCancel', "");
        return false;
    });
    jQuery('#setup-dialog-update').on('click', function() {
        var token = jQuery('#redcap-access-token').val();
        var api = jQuery('#redcap-api-url').val();
        if (api != "") {
            console.log("found an non-default api-url: " + api);
        } else {
            api = "https://abcd-rc.ucsd.edu/redcap/api/";
        }
            
        ipcRenderer.send('getEventsFromREDCap', { token: token, api: api });

        // don't submit dialog again
        return false;
    });

    jQuery('#setup-dialog-remove-text').on('change', function() {
        var v = jQuery('#setup-dialog-remove-text').is(':checked');
        ipcRenderer.send('setupRemoveAnyText', { 'value': v });
    });

    jQuery('#create-participant-file').on('click', function() {
        var pguid = jQuery('#pguid-field').val();
        var dob = jQuery('#dob-field').val();
        var sex = jQuery('#sex-field').val();
        var interview_date = jQuery('#interview-date-field').val();
        if (pguid == "") {
            alert("Error: please provide at least a pGUID field from REDCap.");
            return;
        }
        ipcRenderer.send("createParticipantFile", { pguid: pguid, dob: dob, sex: sex, interview_date: interview_date });
    });

});
