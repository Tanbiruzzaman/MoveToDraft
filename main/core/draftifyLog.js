/******************************************************************************
 Companion file for MoveToDraft
******************************************************************************/
/* jshint laxbreak: true, undef: true, maxerr:999 */
/* globals console, window, document, $, mw */
// <nowiki>

/* ========== Show draftifications for a user ======================= */
function showDraftifications(username, fromDate) {
	var targetUser = username;
	if ( !targetUser && targetUser !== "" ) {
		var pageNameParts = window.config.mw.wgPageName.split( '/' );
		targetUser = ( pageNameParts.length > 1 ) ?  pageNameParts[ 1 ] : '';
	}
	$('#mw-content-text').empty();
	// TODO: Form for setting user
	var today = new Date().toISOString().slice(0,10);
	$('#mw-content-text').append(
		$(`<form id='draftifyLogForm' style='border: 1px solid #ccc; margin: 1em 0; padding: 0 0.5em;'>
			<div style="display:inline-block;padding:0.5em">
				<label for="draftifyUsername">User:</label>
				<input type="text" name="username" id="draftifyUsername" />
			</div>
			<div style="display:inline-block;padding:0.5em">
				<label for="draftifyFromDate">From date (and earlier)</label>
				<input type="date" id="draftifyFromDate" name="fromDate" value="${fromDate || today}" />
			</div>
			<div style="display:inline-block;padding:0.5em">
				<input type="submit" value="Show" />
			</div>
			</form>
		`)
	);
	$('#draftifyUsername').val(targetUser);
	$('#draftifyLogForm').on('submit', function(e) {
		e.preventDefault();
		$('#draftifyLog, #draftifyLogWikitext').show();
		showDraftifications($('#draftifyUsername').val(), $('#draftifyFromDate').val());
	});

	$('#mw-content-text').append(
		$(`<table id='draftifyLog' class='wikitable sortable' style='width:100%'>
		<thead><tr>
			<th scope='col'>From</th>
			<th scope='col'>To</th>
			<th scope='col'>Time</th>
			<th scope='col'>User</th>
			<th scope='col'>Reason</th>
		</tr></thead>
		<tbody></tbody>
		<tfoot><tr>
			<td colspan=5 id="draftifyStatus">Loading...</td>
		</tr></tfoot>
		</table>
		<textarea id="draftifyLogWikitext" disabled="disabled" rows="10">
		`)
	);

	$('#draftifyLogWikitext').val(`{|class="wikitable"
|-
!scope='col'|From
!scope='col'|To
!scope='col'|Time
!scope='col'|User
!scope='col'|Reason
|}`);

	var query = {
		action: "query",
		format: "json",
		list: "logevents",
		leprop: "title|timestamp|comment|details|user",
		letype: "move",
		lenamespace: "0",
		lelimit: "500",
		lestart: (fromDate || today) + "T23:59:59Z"
	};
	if (targetUser) {
		query.leuser = targetUser;
	}

	var continueInfo = {};

	function onLoadMoreClick(e) {
		e.preventDefault();
		$('#draftifyStatus').empty().text("Loading...");
		searchAndShowResults();
	}

	function parseLogTable(wikitext) {
		window.API.post({
			"action": "parse",
			"format": "json",
			"text": wikitext,
			"prop": "text",
			"contentmodel": "wikitext"
		}).then(function(response) {
			const parsedLogTable = $(response.parse.text["*"]);
			$('#draftifyLog tbody').empty().append(
				parsedLogTable.find('tr').slice(1)
			);
		});
	}

	function searchAndShowResults() {
		window.API.get( $.extend({}, query, continueInfo) )
			.then(function(response) {
				// Store continuing info, if any
				continueInfo = response.continue || {};
				// Reset status, add a "Load more" if there are more results
				$('#draftifyStatus').empty().append(
					response.continue
						? $('<a>').css("cursor", "pointer").text('Load more').click(onLoadMoreClick)
						: null
				);
				// Filter to only MoveToDraft script moves
				var draftifyEvents = response.query && response.query.logevents && response.query.logevents.filter(function(logevent) {
					return logevent.params.target_ns === 118; // Moved to Draft namespace
				});
				var noDraftifyEvents = !draftifyEvents || !draftifyEvents.length;

				switch(true) {
					case noDraftifyEvents && !response.continue:
						$('#draftifyStatus').empty().text(
							$('#draftifyLog tbody tr').length === 0 ? "No results" : "No further results"
						);
						break;
					case noDraftifyEvents:
						// Continue with next batch of results, otherwise table will initially have no results but a load more link,
						// or clicking "Load more" will appear to show "Loading..." but not actually add any results
						searchAndShowResults();
						break;
					case !response.continue:
						$('#draftifyStatus').empty().text("No further results");
						/* falls through */
					default:
						draftifyEvents.forEach(function(logevent) {
							var fromTitle = logevent.title;
							var toTitle = logevent.params.target_title;
							var timeOfMove = new Date(logevent.timestamp).toUTCString().replace("GMT", "(UTC)");
							var user = logevent.user;
							var comment = logevent.comment;
							var wikitext = $('#draftifyLogWikitext').val().replace("|}", `|-
|[[${fromTitle}]]
|[[${toTitle}]]
|${timeOfMove}
|[[User:${user}|${user}]]
|${comment}
|}`);
							$('#draftifyLogWikitext').val(wikitext);
							parseLogTable(wikitext);
						});
				}
			});
	}

	// Run by default, unless page loaded without a /username suffix
	if (username || username==="") {
		searchAndShowResults();
	} else {
		$('#draftifyLog, #draftifyLogWikitext').hide();
	}

// End of function showDraftifications
}

document.title = "Draftify log - Wikipedia";
$('h1').text("খসড়া লগ");
$('#mw-content-text').empty()
.text("লোড হচ্ছে...")
.before(
	$('<span>').append(
		'বিজ্ঞপ্তি: এই পাতাটি শুধুমাত্র ',
		$('<a>').attr('href','/wiki/User:Tanbiruzzaman/MoveToDraft').text('MoveToDraft'),
		' ব্যবহারকারী স্ক্রিপ্ট ইনস্টল থাকলে কাজ করবে।'
	),
	$('<hr>')
);
showDraftifications();
// </nowiki>
