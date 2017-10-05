// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// how to call a function in main?

var jQuery = require('jquery');
var {ipcRenderer, remote} = require('electron');
//console.log('ipcRenderer: ' + ipcRenderer + " " + ipcRenderer.send('giveMeSomething', 'blub'));
var main = remote.require("./main.js");
const dialog = remote.dialog;

var current_form = '';

ipcRenderer.on('calledFromMain', function(event, arg) {
    console.log("called from Main with :" + arg);
});

ipcRenderer.on('updateInstrumentList', function(event, data) {
    console.log("got instrument list : " + data);
    jQuery('#current-instrument-list').children().each(function() {
        if (jQuery(this).hasClass('fixed'))
            return true;
        jQuery(this).remove();
    });
    for (var i = 0; i < data.length; i++) {
        /*<li class="list-group-item">
         <img class="img-circle media-object pull-left" src="/assets/img/avatar2.png" width="32" height="32">
        <div class="media-body">
          <strong>List item title</strong>
          <p>Lorem ipsum dolor sit amet.</p>
        </div>
        </li> */
        jQuery('#current-instrument-list').append(
            '<li class="list-group-item" value='+ data[i][0] +'>' + 
            '<img class="img-circle media-object pull-left" src="img/instrument.png" width="32" height="32">' +
            '<div class="media-body">' +  
            '  <strong>' + data[i][0] + '</strong>' + 
            '  <p>' + data[i][1] + '</p>' +
            '</div></li>' );
    }
});

ipcRenderer.on('updateItems', function(event, data) {
    // console.log("show these items:" + data);
    jQuery('#current-items-list').children().remove();
    for (var i = 0; i < data.length; i++) {
        jQuery('#current-items-list').append(
            '<li class="list-group-item" value='+ data[i]['field_name'] +'>' +
            '<div class="tag-group pull-left"></div>' +  
            //'<img class="img-circle media-object pull-left" src="img/item.png" width="32" height="32">' +
            '<div class="media-body">' +  
            '  <strong>' + data[i]['field_name'] + '</strong>' + 
            '  <p>' + data[i]['field_label'] + '</p>' +
            '</div></li>' );
    }
    jQuery('footer h1').text(current_form + " [" + data.length + "]");
    jQuery('#export-current-form-button').prop('disabled','');
    jQuery('#check-data-button').prop('disabled','');
    jQuery('#clear-messages').prop('disabled','');
    jQuery('#export-current-form-data-button').prop('disabled','');
    jQuery('#current-items-list div.tag-group').append(
        '<button class="btn btn-default tag" value="remove" title="remove this item from the export">D</button>' + 
        '<button class="btn btn-default tag" value="long" title="String length <= 60">L</button>' +
        '<button class="btn btn-default tag" value="huge" title="String length <= 200">H</button>'
    );
    jQuery('#current-items-list div.tag-group').each(function() {
        // try to get the tags for this item
        var item = jQuery(this).parent().attr('value');
        //console.log("try to get tags for " + item);
        ipcRenderer.send('getTags', [ { 'item': item, 'id': this } ]);
    });
});

ipcRenderer.on('updateTagValues', function(event, data) {
    // 'tags': store.get( 'tag-' + data[i]['item'] ), 'data': data
    for (var i = 0; i < data.length; i++) {
       //console.log("need to update the tag for " + data[i]['item'] + " tag: " + data[i]['tags'] );
       var itemEntry = jQuery('#current-items-list').find('[value="' + data[i]['item'] + '"]');
       //console.log("found itemEntry with :" + jQuery(itemEntry).text());
       for (var j = 0; j < data[i]['tags'].length; j++) {
           jQuery(itemEntry).find('[value="' + data[i]['tags'][j] + '"]').removeClass("btn-default").addClass('btn-primary');
       }
    }
});

// draw the result for this item to the screen
ipcRenderer.on('showItemCheck', function(event, data) {
    var item = data['item'];
    var result = data['result'];
    var form = data['form'];
    var status = data['status'];
    var previous_item = jQuery('#message-list').find('[value="'+ item + '"]');
    if (previous_item.length > 0) {
        jQuery(previous_item).children().remove();
        jQuery(previous_item).append('<img class="img-circle media-object pull-left" src="img/' + status + '.png" width="32" height="32">' +
            '<div class="media-body">' +  
            '  <strong>' + form + " [" + item + ']</strong>' + 
            '  <p>' + result + '</p>' +
            '</div>');
    } else {
        jQuery('#message-list').append('<li class="list-group-item" value="'+ item +'" form="' + form + '">' + 
            '<img class="img-circle media-object pull-left" src="img/' + status + '.png" width="32" height="32">' +
            '<div class="media-body">' +  
            '  <strong>' + item + " [" + form + ']</strong>' + 
            '  <p>' + result + '</p>' +
            '</div></li>' );
    }
    var entry = jQuery('#message-list').find('[value="'+ item + '"]');
    jQuery('#message-list li.list-group-item').removeClass('active');
    jQuery(entry).addClass('active');
});

ipcRenderer.on('alert', function(event, data) {
    alert("Your request for checking form data failed. Most likely there is not enough memory in the server to request all the data for this form at once. Please test again using single items.\n\n\n" + data);
});

//
jQuery(document).ready(function() {

    jQuery('#open-setup-dialog').on('click', function() {
        console.log('open another dialog and get values for connectivity to REDCap');
        ipcRenderer.send('openSetupDialog', "");
        console.log("open another dialog finished");
        //jQuery("#redcap-access-token").value( "BLABLABLA" );
        setTimeout(function() {
            ipcRenderer.send('my-msg', 'hi');
        }, 3000);
    });

    jQuery('#setup-dialog-ok').on('click', function() {
        console.log("OK button click!");
        ipcRenderer.sendSync('closeSetupDialog',"");
    });

    jQuery('#instrument-search').on('keyup', function() {
        var t = jQuery(this).val();
        console.log("search list");
        jQuery('#current-instrument-list li.list-group-item').each(function(a) {
            var t1 = jQuery(this).attr('value'); // instrument
            var t2 = jQuery(this).text();
            var s = new RegExp(jQuery('#instrument-search').val(), 'i');
            if (t2.match(s) !== null) {
                jQuery(this).show();
            } else {
                jQuery(this).hide();
            }
        });
    });

    jQuery('#current-instrument-list').on('click', '.list-group-item', function() {
        console.log("click on list group item - update display: " + jQuery(this).attr('value'));
        jQuery(this).parent().children().removeClass('active');
        jQuery(this).addClass('active');
        current_form = jQuery(this).attr('value');
        ipcRenderer.send('getItemsForForm', current_form);
    });

    jQuery('#current-items-list').on('click', '.list-group-item', function() {
        var item = jQuery(this).attr('value');
        ipcRenderer.send('checkItem', { item: item, form: current_form });
    });

    jQuery('#export-current-form-button').on('click', function() {
        //var dialog = remote.require('dialog');
        dialog.showSaveDialog({ defaultPath: current_form + ".csv" }, function (filename) {
            ipcRenderer.send('exportForm', { form: current_form, filename: filename });
        });
    });

    jQuery('#export-current-form-data-button').on('click', function() {
        dialog.showSaveDialog({ defaultPath: current_form + "_data.csv" }, function (filename) {
            ipcRenderer.send('exportData', { form: current_form, filename: filename });
        });
    });

    jQuery('#check-data-button').on('click', function(){
        ipcRenderer.send('checkData', { form: current_form });
    });

    jQuery('#clear-messages').on('click', function() {
        jQuery('#message-list').children().remove();
    });

    jQuery('#current-items-list').on('click', '.tag', function() {
        if (jQuery(this).hasClass('btn-primary')) {
            jQuery(this).removeClass('btn-primary');
            jQuery(this).addClass('btn-default');
            var tag = jQuery(this).attr('value');
            var item = jQuery(this).parent().parent().attr('value');
            // remove the tag again
            ipcRenderer.send('deleteTags', [ { 'item': item, 'tags': [ tag ] } ]);            
        } else {
            jQuery(this).removeClass('btn-default');
            jQuery(this).addClass('btn-primary');    
            var tag = jQuery(this).attr('value');
            var item = jQuery(this).parent().parent().attr('value');
            // add the tag for this item
            ipcRenderer.send('setTags', [ { 'item': item, 'tags': [ tag ] } ]);
        }

        // disable the default
        return false;
    })

    setTimeout(function() { jQuery('#open-setup-dialog').trigger('click'); }, 500);
});
