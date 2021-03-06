// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

// how to call a function in main?

var jQuery = require('jquery');
var {
	ipcRenderer,
	remote
} = require('electron');
//console.log('ipcRenderer: ' + ipcRenderer + " " + ipcRenderer.send('giveMeSomething', 'blub'));
var main = remote.require("./main.js");
const dialog = remote.dialog;

var current_form = '';

ipcRenderer.on('calledFromMain', function(event, arg) {
	console.log("called from Main with :" + arg);
});

ipcRenderer.on('updateInstrumentList', function(event, data) {
	jQuery('#current-instrument-list').children().each(function() {
		if (jQuery(this).hasClass('fixed'))
			return true;
		jQuery(this).remove();
	});
	console.log("Add instrument names");
	for (var i = 0; i < data.length; i++) {
		/*<li class="list-group-item">
		 <img class="img-circle media-object pull-left" src="/assets/img/avatar2.png" width="32" height="32">
		<div class="media-body">
		  <strong>List item title</strong>
		  <p>Lorem ipsum dolor sit amet.</p>
		</div>
		</li> */
		// lets check if we have an alternative name for this instrument
		ipcRenderer.send('getTags', [{
			'item': data[i][0],
			'prefix': 'instrument-'
		}, {
			'item': data[i][0],
			'prefix': 'guard-'
		}]);
		//console.log("for " + data[i][0] + " we have : " + data[i][1] + " in updateInstrumentList");
		jQuery('#current-instrument-list').append(
			'<li class="list-group-item" value=' + data[i][0] + '>' +
			'<img class="img-circle media-object pull-left" src="img/instrument.png" width="32" height="32">' +
			'<div class="media-body">' +
			'  <strong>' + data[i][0] + '</strong>' +
			'  <div><button class="btn btn-default edit"><span class="icon icon-feather"></span></button> <span class="description">' + data[i][1] + '</span></div>' +
			'  <div class="guard-group"><span class="guard_name"></span></div>' +
			'</div></li>');
	}
});


/*
ipcRenderer.on('message', function(event, data) {
    alert(data);
}); 
*/

ipcRenderer.on('updateItems', function(event, data) {
	// console.log("show these items:" + data);
	jQuery('#current-items-list').children().remove();
	// we should sort the data by the order from the data dictionary first

	for (var i = 0; i < data.length; i++) {
		jQuery('#current-items-list').append(
			'<li class="list-group-item" value=' + data[i]['field_name'] + ' order=\"' + data[i]['order'] + '\">' +
			'<div class="tag-group pull-left"></div>' +
			//'<img class="img-circle media-object pull-left" src="img/item.png" width="32" height="32">' +
			'<div class="media-body">' +
			'  <strong>' + data[i]['field_name'] + '</strong>' +
			'  <p>' + data[i]['field_label'] + '</p>' +
			'</div></li>');
	}
	jQuery('footer h1').text(current_form + " [" + data.length + "]");
	jQuery('#export-current-form-button').prop('disabled', '');
	//jQuery('#export-nda-select').prop('disabled','');
	jQuery('#check-data-button').prop('disabled', '');
	jQuery('#clear-messages').prop('disabled', '');
	jQuery('#export-current-form-data-button').prop('disabled', '');
	jQuery('#current-items-list div.tag-group').append(
		'<button class="btn btn-default tag" value="remove" title="Disable this item, do not export. Use Ctrl-Click to open remove by event dialog.">D</button>' +
		'<button class="btn btn-default tag" value="long" title="Increase max string length to 60">L</button>' +
		'<button class="btn btn-default tag" value="huge" title="Increase max string length to 200">H</button>' +
		'<button class="btn btn-default tag" value="date" title="Convert the given value to NDA date">T</button>' +
		'<button class="btn btn-default tag" value="label" title="Export as label not as number">V</button>' +
		'<button class="btn btn-default tag" value="clearcheckboxes" title="Remove checkbox fields if none set">X</button>' +
		'<button class="btn btn-default tag" value="branching2notes" title="Copy branching logic information to notes section">N</button>' +
		'<button class="btn btn-default tag" value="recommended" title="If a condition exists, make this field recommended, not conditional">R</button>' +
		'<button class="btn btn-default tag" value="alias" title="Add an alias for this item name">A</button>'
	);
	jQuery('#current-items-list div.tag-group').each(function() {
		// try to get the tags for this item
		var item = jQuery(this).parent().attr('value');
		//console.log("try to get tags for " + item);
		ipcRenderer.send('getTags', [{
			'item': item,
			'id': this
		}]);
	});
});

ipcRenderer.on('ndaSelectButtonTextChange', function(event, data) {
	if (typeof data['shortName'] !== 'undefined' && data['shortName'] !== '') {
		jQuery('#nda-select-button-text').text('NDA Select (' + data['shortName'] + ')');
	} else {
		jQuery('#nda-select-button-text').text('NDA Select');
	}
});

ipcRenderer.on('updateTagValues', function(event, data) {
	// if the prefix in data is not 'tag-'
	console.log("updateTagValues with :" + JSON.stringify(data));
	// 'tags': store.get( 'tag-' + data[i]['item'] ), 'data': data
	for (var i = 0; i < data.length; i++) {
		if (typeof data[i]['prefix'] !== 'undefined' && data[i]['prefix'] == 'instrument-') {
			var instr = data[i]['item'];
			// ok, update the name of that instrument, not the tags on an item
			jQuery('#current-instrument-list li').each(function() {
				if (jQuery(this).attr('value') == instr) {
					//console.log("in updateTagValues: " + JSON.stringify(data[i]));
					jQuery(this).attr('version', data[i]['tags'][1]);
					jQuery(this).attr('nda_name', data[i]['tags'][2]);
					console.log("set guard name to: " + data[i]['guard_name']);
					if (typeof data[i]['guard_name'] !== 'undefined' && data[i]['guard_name'] !== "") {
						jQuery(this).attr('guard_name', data[i]['guard_name']);
						jQuery(this).find('span.guard_name').text(" GUARDED by " + data[i]['guard_name']);
					}
					jQuery(this).find('.description').text(" " + data[i]['tags'][0]);
					jQuery(this).find('.edit span').addClass('from-store');
				}
			});
			if (typeof data[i]['additional-action'] !== 'undefined' && data[i]['additional-action'] == 'delete') {
				console.log("Do we have additional-action? " + JSON.stringify(data[i]));
				ipcRenderer.send('deleteTags', [{
					'prefix': data[i]['prefix'],
					'item': instr,
					'tags': [instr]
				}]);
				// also remove the class from this edit span again
				jQuery('#current-instrument-list li').each(function() {
					if (jQuery(this).attr('value') == instr) {
						jQuery(this).find('.edit span').removeClass('from-store');
					}
				});
			}
		} else if (typeof data[i]['prefix'] !== 'undefined' && data[i]['prefix'] == 'guard-') {
			var instr = data[i]['item'];
			// ok, update the name of that instrument, not the tags on an item
			jQuery('#current-instrument-list li').each(function() {
				if (jQuery(this).attr('value') == instr) {
					if (typeof data[i]['tags'] !== 'undefined' && data[i]['tags'].length > 0 && data[i]['tags'][0] !== "") {
						jQuery(this).attr('guard_name', data[i]['tags'][0]);
						jQuery(this).find('span.guard_name').text(" GUARDED by " + data[i]['tags'][0]);
					}
				}
			});
		} else {
			//console.log("need to update the tag for " + data[i]['item'] + " tag: " + data[i]['tags'] );
			var itemEntry = jQuery('#current-items-list').find('[value="' + data[i]['item'] + '"]');
			//console.log("found itemEntry with :" + jQuery(itemEntry).text());
			if (typeof data[i]['tags'] === 'string') // if by chance this tag is a string, convert to array before check
				data[i]['tags'] = data[i]['tags'].split(" ");
			for (var j = 0; j < data[i]['tags'].length; j++) {
				jQuery(itemEntry).find('[value="' + data[i]['tags'][j] + '"]').removeClass("btn-default").addClass('btn-primary');
			}
		}
	}
});

// draw the result for this item to the screen
ipcRenderer.on('showItemCheck', function(event, data) {
	var item = data['item'];
	var result = data['result'];
	var form = data['form'];
	var status = data['status'];
	var order = data['order'];
	var previous_item = jQuery('#message-list').find('[value="' + item + '"]');
	if (previous_item.length > 0) {
		jQuery(previous_item).children().remove();
		jQuery(previous_item).append('<img class="img-circle media-object pull-left" src="img/' + status + '.png" width="32" height="32">' +
			'<div class="media-body">' +
			'  <strong>' + item + " [" + form + ']</strong>' +
			'  <p>' + result + '</p>' +
			'</div>');
	} else {
		// find the correct position to add this item (based on the order)
		var inserted = false;
		var elems = jQuery('#message-list li');
		var it = jQuery('<li class="list-group-item" value="' + item + '" form="' + form + '" order="' + order + '">' +
			'<img class="img-circle media-object pull-left" src="img/' + status + '.png" width="32" height="32">' +
			'<div class="media-body">' +
			'  <strong>' + item + " [" + form + ']</strong>' +
			'  <p>' + result + '</p>' +
			'</div></li>');
		jQuery('#message-list').append(it);
	}
	// sort entries by order
	jQuery('#message-list li').sort(function(a, b) {
		var c1 = parseInt(jQuery(a).attr('order'));
		var c2 = parseInt(jQuery(b).attr('order'));
		return (c1 < c2) ? -1 : (c1 > c2) ? 1 : 0;
	}).appendTo('#message-list');

	var entry = jQuery('#message-list').find('[value="' + item + '"]');
	jQuery('#message-list li.list-group-item').removeClass('active');
	jQuery(entry).addClass('active');
});

ipcRenderer.on('alert', function(event, data) {
	alert("Your request for checking form data failed. Most likely there is not enough memory in the server to request all the data for this form at once. Please test again using single items.\n\n\n" + data);
});

ipcRenderer.on('error', function(event, data) {
	alert(data);
});

ipcRenderer.on('message', function(event, data) {
	jQuery('footer h1').text(data);
});

ipcRenderer.on('info', function(event, data) {
	jQuery('#console').val(jQuery('#console').val() + data + "\n");
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
		//console.log("OK button click!");
		ipcRenderer.sendSync('closeSetupDialog', "");
	});

	jQuery('#change-label-dialog-ok').on('click', function() {
		//console.log("OK button click!");
		ipcRenderer.sendSync('closeChangeLabelDialog', "");
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
		ipcRenderer.send('checkItem', {
			item: item,
			form: current_form
		});
	});

	jQuery('#export-current-form-button').on('click', function() {
		//var dialog = remote.require('dialog');
		dialog.showSaveDialog({
			defaultPath: current_form + "_dictionary.csv"
		}, function(filename) {
			if (typeof filename !== 'undefined')
				ipcRenderer.send('exportForm', {
					form: current_form,
					filename: filename
				});
		});
	});

	jQuery('#export-nda-select').on('click', function() {
		ipcRenderer.send('openNDASelectDialog', "");
	});

	jQuery('#nda-select-dialog-ok').on('click', function() {
		console.log("OK button click!");
		ipcRenderer.sendSync('closeNDASelectDialog', "");
	});

	jQuery('#export-current-form-data-button').on('click', function() {
		dialog.showSaveDialog({
			defaultPath: current_form + "_data.csv"
		}, function(filename) {
			if (typeof filename !== 'undefined')
				ipcRenderer.send('exportData', {
					form: current_form,
					filename: filename
				});
		});
	});

	jQuery('#check-data-button').on('click', function() {
		ipcRenderer.send('checkData', {
			form: current_form
		});
	});

	jQuery('#clear-messages').on('click', function() {
		jQuery('#message-list').children().remove();
	});

	jQuery('#current-items-list').on('click', '.tag', function(evt) {
		if (jQuery(this).hasClass('btn-primary')) {
			jQuery(this).removeClass('btn-primary');
			jQuery(this).addClass('btn-default');
			var tag = jQuery(this).attr('value');
			var item = jQuery(this).parent().parent().attr('value');
			// remove the tag again
			ipcRenderer.send('deleteTags', [{
				'item': item,
				'tags': [tag]
			}]);
		} else {
			jQuery(this).removeClass('btn-default');
			jQuery(this).addClass('btn-primary');
			var tag = jQuery(this).attr('value');
			var item = jQuery(this).parent().parent().attr('value');
			// add the tag for this item
			ipcRenderer.send('setTags', [{
				'item': item,
				'tags': [tag]
			}]);
			// for a date field we need some input
			if (tag == 'date') {
				ipcRenderer.send('openGetDateStringDialog', {
					'item': item
				});
			}
			if (tag == 'alias') {
				ipcRenderer.send('openGetImportAliasDialog', {
					'item': item
				});
			}
			if (tag == 'remove' && evt.ctrlKey) { // we only want to open if the user did a special click 
				ipcRenderer.send('openDeleteEventDialog', {
					'item': item
				});
			}
		}

		// disable the default
		return false;
	});

	jQuery('#current-instrument-list').on('click', 'button.edit', function() {
		console.log("click on button, name: " + jQuery(this).text());
		// use the name in this dialog - if there is no name assigned show an empty string
		var default_text = jQuery(this).parent().text().trim();
		// console.log("got default text of : " + jQuery(this).parent().parent().find('strong').text());
		var instrument = jQuery(this).parent().parent().parent().attr('value'); // unique name of this instrument
		var version = jQuery(this).parent().parent().parent().attr('version');
		var nda_name = jQuery(this).parent().parent().parent().attr('nda_name');
		var guard_name = jQuery(this).parent().parent().parent().attr('guard_name');
		// maybe we have a value for this instrument as a tag?
		// no, we will only show descriptions that are current (default or tag value)
		//console.log("Open change label dialog with: " + default_text + " " + instrument);
		ipcRenderer.send('openChangeLabelDialog', {
			'name': default_text,
			'instrument': instrument,
			'version': version,
			'nda_name': nda_name,
			'guard_name': guard_name
		});
		console.log("open another dialog finished with " + JSON.stringify({
			'name': default_text,
			'instrument': instrument,
			'version': version,
			'nda_name': nda_name,
			'guard_name': guard_name
		}));
		return false;
	});

	// synchronize the scrolling between the two list displays (one way)
	jQuery('#items-pane').on('scroll', function() {
		//console.log("scroll on first column");
		jQuery('#message-pane').prop("scrollTop", this.scrollTop).prop("scrollLeft", this.scrollLeft);
	});

	setTimeout(function() {
		jQuery('#open-setup-dialog').trigger('click');
	}, 500);
});