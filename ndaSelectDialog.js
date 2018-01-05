var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");
const dialog = remote.dialog;
let current_item;

ipcRenderer.on('my-msg', function(arg) {
    console.log("the setupDialog got a message : " + arg);
});

ipcRenderer.on('ndaDDFromREDCap', function(event, data) {
    //alert('got data back from REDCap: ' + JSON.stringify(data) );
    jQuery('#nda-select').children().remove();
    for(var i = 0; i < data.length; i++) {
        jQuery('#nda-select').append('<li class="list-group-item" value="'+data[i]['shortName']+'">'+ data[i]['title']+ ' (' + data[i]['shortName'] + ')</li>');
    }
});

jQuery(document).ready(function() {

    console.log("need to get entries from NDA, ask main to fill our list");
    ipcRenderer.send('ndaDDFromREDCap', "");

    jQuery('#nda-select-dialog-ok').on('click', function() {
        // get the selected entry
        ipcRenderer.send('closeNDASelectDialogOk', { 'shortName': current_item } );
        return false;
    });
    jQuery('#nda-select-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeNDASelectDialogCancel', "");
        return false;
    });
    jQuery('#nda-select-dialog-clear').on('click', function() {
        //ipcRenderer.send('closeNDASelectDialogCancel', "");
        jQuery('#nda-select.list-group-item').parent().children().removeClass('active');
        current_item = '';
        return false;
    });

    jQuery('#nda-select').on('click', '.list-group-item', function() {
        console.log("click on list group item - update display: " + jQuery(this).attr('value'));
        jQuery(this).parent().children().removeClass('active');
        jQuery(this).addClass('active');
        current_item = jQuery(this).attr('value');
        //ipcRenderer.send('getItemsForForm', current_form);
    });

    jQuery('#nda-search').on('keyup', function() {
        jQuery('#nda-select').children().each(function() {
            var t = jQuery(this).text();
            console.log('text: ' + t);
            if (t.match(new RegExp(jQuery('#nda-search').val(),'i') )) {
                jQuery(this).show();
            } else {
                jQuery(this).hide();
            }
        });
    });
});
