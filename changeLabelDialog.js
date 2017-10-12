var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

ipcRenderer.on('my-msg', function(arg) {
    console.log("the changeLabelDialog got a message : " + arg);
});

ipcRenderer.on('changeLabelCurrentName', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    // alert("in change label dialog, try to add :" + data);
    jQuery('#change-label-dialog-name').val(data['name']);
    jQuery('#change-label-dialog-name').attr('instrument', data['instrument']);
});

jQuery(document).ready(function() {

    jQuery('#change-label-dialog-ok').on('click', function() {
        var name = jQuery('#change-label-dialog-name').val();
        var instrument = jQuery('#change-label-dialog-name').attr('instrument');

        ipcRenderer.send('closeChangeLabelDialogOk', { name: name, instrument: instrument } );
        return false;
    });
    jQuery('#change-label-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeChangeLabelDialogCancel', "");
        return false;
    });
    jQuery('#change-label-dialog-reset').on('click', function() {
        var name = jQuery('#change-label-dialog-name').val();
        var instrument = jQuery('#change-label-dialog-name').attr('instrument');

        ipcRenderer.send('closeChangeLabelDialogReset', { name: name, instrument: instrument });
        return false;
    });
});
