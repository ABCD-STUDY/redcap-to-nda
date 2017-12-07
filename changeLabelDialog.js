var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

ipcRenderer.on('my-msg', function(arg) {
    console.log("the changeLabelDialog got a message : " + arg);
});

ipcRenderer.on('changeLabelCurrentName', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    // alert("in change label dialog, try to add :" + data);
    if (typeof data['name'] === 'undefined' || data['name'] == null) {
        jQuery('#change-label-dialog-name').val("");        
    } else {
        jQuery('#change-label-dialog-name').val(data['name']);
    }
    if (typeof data['nda_name'] === 'undefined' || data['nda_name'] == null) {
        jQuery('#change-label-dialog-nda-name').val("");        
    } else {
        jQuery('#change-label-dialog-nda-name').val(data['nda_name']);
    }
    if (typeof data['version'] === 'undefined' || data['version'] == null) {
        jQuery('#change-label-dialog-version').val("");        
    } else {
        jQuery('#change-label-dialog-version').val(data['version']);
    }

    jQuery('#change-label-dialog-name').attr('instrument', data['instrument']);
});

jQuery(document).ready(function() {

    jQuery('#change-label-dialog-ok').on('click', function() {
        var name = jQuery('#change-label-dialog-name').val();
        var nda_name = jQuery('#change-label-dialog-nda-name').val();
        var version = jQuery('#change-label-dialog-version').val();
        var instrument = jQuery('#change-label-dialog-name').attr('instrument');

        ipcRenderer.send('closeChangeLabelDialogOk', { name: name, instrument: instrument, nda_name: nda_name, version: version } );
        return false;
    });
    jQuery('#change-label-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeChangeLabelDialogCancel', "");
        return false;
    });
    jQuery('#change-label-dialog-reset').on('click', function() {
        var name = jQuery('#change-label-dialog-name').val();
        var nda_name = jQuery('#change-label-dialog-nda-name').val();
        var version = jQuery('#change-label-dialog-version').val();
        var instrument = jQuery('#change-label-dialog-name').attr('instrument');

        ipcRenderer.send('closeChangeLabelDialogReset', { name: name, instrument: instrument, nda_name: nda_name, version: version });
        return false;
    });
});
