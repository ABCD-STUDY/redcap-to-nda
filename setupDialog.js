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

    jQuery('#setup-dialog-ok').on('click', function() {
        var token = jQuery('#redcap-access-token').val();
        var choice = jQuery('#setup-events-list').val();
        var url    = jQuery('#redcap-api-url').val(); // if no value is provided use ABCD
        if (url.trim() === "") {
            url = "https://abcd-rc.ucsd.edu/redcap/api/";
        }
        if (token == "" || choice == "" || choice == null || typeof choice == 'undefined') {
            alert("Error: please enter a token, press Update and select an event");
            return false;
        }

        ipcRenderer.send('closeSetupDialogOk', { token: token, event: choice, url: url } );
        return false;
    });
    jQuery('#nda-subject-json').on('click', function() {
        dialog.showOpenDialog({ properties: ['openFile'], extensions: ['json'], defaultPath: "subject_data.json" }, function (filename) {
            ipcRenderer.send('openLoadJSONDialog', { filename: filename });
        });        
        return false;
    });
    jQuery('#setup-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeSetupDialogCancel', "");
        return false;
    });
    jQuery('#setup-dialog-update').on('click', function() {
        var token = jQuery('#redcap-access-token').val();
        ipcRenderer.send('getEventsFromREDCap', token);

        // don't submit dialog again
        return false;
    });

});
