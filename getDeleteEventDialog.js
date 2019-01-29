var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');

var main = remote.require("./main.js");

ipcRenderer.on('my-msg', function(arg) {
    console.log("the deleteEventDialog got a message : " + arg);
});

// create the list of events (once at the beginning)
ipcRenderer.on('getDeleteEventEventList', function(event, data) {
    //alert('add all the checkboxes now');
    jQuery('#delete-event-list').children().remove();
    for (var i = 0; i < data['events'].length; i++) {
        jQuery('#delete-event-list').append("<div class='checkbox'><label><input type='checkbox' item='unknown' id='event-"+
                                            data['events'][i]+"' class='delete-event-list-entry' value='"+data['events'][i]+
                                            "'> "+data['events'][i]+"</label></div>");
    }
    // now update the checkbox for the current participant
    ipcRenderer.send('updateDeleteEventCheckboxes', { item: data['item'] } );
});

ipcRenderer.on('getDeleteEventCurrentDelete', function(event, data) {
    //alert('got data back from REDCap: ' + data );
    // alert("in change label dialog, try to add :" + data);
    //alert("remove variable is: " + data['remove']);
    var markedDelete = data['remove'].split(" ");
    jQuery('input.delete-event-list-entry').each(function() {
        //alert("Try to set ITEM TO : " + data['item'] + " on element " + jQuery(this));
        jQuery(this).attr('item', data['item']);
        var event = jQuery(this).attr('value');
        if (markedDelete.indexOf(event) > -1) {
            jQuery(this).prop('checked', true);
        } else {
            jQuery(this).prop('checked', false);
        }
    });

    //jQuery('#get-delete-event-dialog-delete').val(data['remove']);
    //jQuery('#get-delete-event-dialog-delete').attr('item', data['item']);
});

ipcRenderer.on('changeDelete', function(event, data) {
    var item  = data['item'];
    var dele = data['delete'];
    if (typeof dele == 'undefined')
        dele = "";
    //alert("got called changeDelete with " + JSON.stringify(data));

    console.log("remove variable is: " + data['delete']);
    var markedDelete = dele.split(" ");
    //alert("SHOULD OPEN Try to set ITEM now " + jQuery('#delete-event-list').children().length);
    jQuery('#delete-event-list').find('input').each(function() {
        //alert("Try to set ITEM TO : " + item + " on element " + jQuery(this));
        jQuery(this).attr('item', item);
        var event = jQuery(this).attr('value');
        if (markedDelete.indexOf(event) > -1) {
            jQuery(this).prop('checked', true);
        } else {
            jQuery(this).prop('checked', false);
        }
    });

    //jQuery('#get-delete-event-dialog-delete').val(dele);
    //jQuery('#get-delete-event-dialog-delete').attr('item', item);
});

jQuery(document).ready(function() {

    jQuery('#get-delete-event-dialog-ok').on('click', function() {
        var name = [];
        var item = "";
        jQuery('input.delete-event-list-entry').each(function() {
            item = jQuery(this).attr('item');
            //alert("WE HAVE SET item to: " + item + " from this dialog element: " + jQuery(this));
            var event = jQuery(this).attr('value');

            if (jQuery(this).prop('checked')) {
                name.push(event);
            }
        });
        //alert("OK got us this list of events: " + JSON.stringify(name) + " for : " + item);
        //var name = jQuery('#get-delete-event-dialog-delete').val();
        //var item = jQuery('#get-delete-event-dialog-delete').attr('item');

        ipcRenderer.send('closeGetDeleteEventDialogOk', { delete: name, item: item } );
        return false;
    });
    jQuery('#get-delete-event-dialog-cancel').on('click', function() {
        ipcRenderer.send('closeGetDeleteEventDialogCancel', "");
        return false;
    });

    jQuery('#get-delete-event-dialog-delete-all').on('change', function() {
        if (jQuery('#get-delete-event-dialog-delete-all').prop('checked')) {
            // check all the individual fields
            jQuery('input.delete-event-list-entry').each(function() {
                jQuery(this).prop('checked', true);
            });
        } else {
            jQuery('input.delete-event-list-entry').each(function() {
                jQuery(this).prop('checked', false);
            });
        }
    });
});
