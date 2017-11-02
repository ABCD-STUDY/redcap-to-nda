var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

ipcRenderer.on('my-msg', function(arg) {
    console.log("the changeLabelDialog got a message : " + arg);
});

ipcRenderer.on('getDateStringCurrentParse', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    // alert("in change label dialog, try to add :" + data);
    jQuery('#get-date-string-dialog-parse').val(data['parse']);
    jQuery('#get-date-string-dialog-parse').attr('item', data['item']);
});

ipcRenderer.on('changeParse', function(event, data) {
    var item  = data['item'];
    var parse = data['parse'];
    console.log("got called changeParse with " + JSON.stringify(data));
    jQuery('#get-date-string-dialog-parse').val(parse);
    jQuery('#get-date-string-dialog-parse').attr('item', item);
});

jQuery(document).ready(function() {

    jQuery('#get-date-string-dialog-ok').on('click', function() {
        var name = jQuery('#get-date-string-dialog-parse').val();
        var item = jQuery('#get-date-string-dialog-parse').attr('item');

        ipcRenderer.send('closeGetDateStringDialogOk', { parse: name, item: item } );
        return false;
    });
    jQuery('#get-date-string-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeGetDateStringDialogCancel', "");
        return false;
    });
});
