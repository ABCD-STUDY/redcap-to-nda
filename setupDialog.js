var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

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
        if (token == "" || choice == "" || choice == null || typeof choice == 'undefined') {
            alert("Error: please enter a token, press Update and select an event");
            return false;
        }

        ipcRenderer.send('closeSetupDialogOk', { token: token, event: choice } );
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
