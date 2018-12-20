var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

ipcRenderer.on('my-msg', function(arg) {
    console.log("the changeLabelDialog got a message : " + arg);
});

ipcRenderer.on('getImportAliasCurrentAlias', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    // alert("in change label dialog, try to add :" + data);
    jQuery('#get-import-alias-dialog-alias').val(data['alias']);
    jQuery('#get-import-alias-dialog-alias').attr('item', data['item']);
});

ipcRenderer.on('changeAlias', function(event, data) {
    var item  = data['item'];
    var alias = data['alias'];
    console.log("got called changeAlias with " + JSON.stringify(data));
    jQuery('#get-import-alias-dialog-alias').val(alias);
    jQuery('#get-import-alias-dialog-alias').attr('item', item);
});

jQuery(document).ready(function() {

    jQuery('#get-import-alias-dialog-ok').on('click', function() {
        var name = jQuery('#get-import-alias-dialog-alias').val();
        var item = jQuery('#get-import-alias-dialog-alias').attr('item');

        ipcRenderer.send('closeGetImportAliasDialogOk', { alias: name, item: item } );
        return false;
    });
    jQuery('#get-import-alias-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeGetImportAliasDialogCancel', "");
        return false;
    });
});
