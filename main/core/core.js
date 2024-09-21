/******************************************************************************
 Companion file for MoveToDraft
******************************************************************************/
/* jshint laxbreak: true, undef: true, maxerr:999 */
/* globals console, window, document, $, mw */
// <nowiki>

// Wikitext strings
window.mtd.config.wikitext = {
	"editsummary": window.m2d_editsummary || window.m2d_rationale ||
		"[[WP:AFC|নিবন্ধ সৃষ্টিকরণ]] খসড়া",
	"logMsg": "#[[$1]] পাতাটি ~~~~~ সময়ে [[$2]] শিরোনামে স্থানান্তরিত হয়েছে",
	"notificationHeading": "[[খসড়া:$1|$1]] খসড়ায় স্থানান্তর করা হয়েছে",
	"notificationTemplate": window.m2d_notification ||
		"[[খসড়া:$1|$1]]-এ আপনার অবদানের জন্য ধন্যবাদ। দুর্ভাগ্যবশত, এটি এখনও প্রকাশের জন্য প্রস্তুত হয়েছে বলে মনে হচ্ছেনা,$3।\nআমি আপনার নিবন্ধটিকে একটি খসড়াতে রূপান্তরিত করেছি যা আপনি কিছুক্ষণের জন্য নিরবচ্ছিন্নভাবে উন্নত করতে পারেন৷\n\nআরও তথ্যের জন্য অনুগ্রহ করে [[সাহায্য:সূচী]] দেখুন।\nনিবন্ধটি প্রকাশের জন্য প্রস্তুত হলে, অনুগ্রহ করে পাতার শীর্ষে \"পর্যালোচনার জন্য খসড়াটি জমা দিন!\" বোতামে ক্লিক করুন বা পাতাটিতে পুনরায় স্থানান্তর করুন। ~~~~",
	"rationale": window.m2d_rationale ||
		"মূল নামস্থানে থাকার [[WP:DRAFTIFY|উপযুক্ত নয়]], আগে খসড়া পাতায় মানোন্নয়ন করুন"
};
// Custom change tag to be applied to all M2D actions, create at Special:Tags
window.mtd.config.changeTags = '';
window.mtd.config.draftReasons = [
	{ "long" : "এতে কোনো তথ্যসূত্র নেই", "short" : "উৎসহীন" },
	{ "long" : "এটি উল্লেখযোগ্যতা প্রতিষ্ঠার জন্য আরও উৎস প্রয়োজন",
		"short" : "আরও তথ্যসূত্র প্রয়োজন" },
	{ "long" : "এতে ভাষা বা ব্যাকরণের অনেক সমস্যা রয়েছে",
		"short" : "ভাষা/ব্যকরণগত সমস্যা" },
	{ "long" : "এতে অনেক যান্ত্রিক অনুবাদ রয়েছে", "short" : "যান্ত্রিক-অনুবাদ" },
	{ "long" : "এটি প্রচারমূলক এবং একটি বিজ্ঞাপনের মতো",
		"short" : "প্রচারমূলক/বিজ্ঞাপন" },
	{ "long" : "আপনার সম্ভাব্য স্বার্থের সংঘাত থাকতে পারে",
		"short" : "সম্ভাব্য স্বার্থের সংঘাত" }
];
window.mtd.config.minimumAgeInMinutes = 1440;
window.mtd.config.maximumAgeInDays = 90;

window.mtd.config.doNotLog = (
        window.m2d_doNotLog ? true : false );
// Page data -- to be retreived later from api
window.mtd.config.pagedata = {};
window.mtd.config.pagedata.previousDraftification = false;
window.mtd.config.pagedata.contributors = {};
window.mtd.config.pagedata.notifyList = [];
window.mtd.config.processTimer = [];

// Helper functions
// - prettify an encoded page title (or at least replace underscores with
// spaces)
var getPageText = function(p) {
	var t = mw.Title.newFromText( decodeURIComponent(p) );
	if (t) {
		return t.getPrefixedText();
	} else {
		return p.replace(/_/g, " ");
	}
};

/**
 * makeApiErrorMsg
 *
 * Makes an error message, suitable for displaying to a user, from the values
 * that the MediaWiki Api passes to the failure callback function, e.g.
 * `new mw.Api.get(queryObject}).done(successCallback).fail(failureCallback)`
 *
 * @param {string} code
 *  First paramater passed to failure callback function.
 * @param {jQuery.jqXHR} jqxhr
 *  Second paramater passed to failure callback function.
 * @return {string} Error message details, with in a format like
 *  "(API|HTTP) error: details"
 */
var makeErrorMsg = function(code, jqxhr) {
	var details = '';
	if ( code === 'http' && jqxhr.textStatus === 'error' ) {
		details = 'এইচটিটিপি ত্রুটি ' + jqxhr.xhr.status;
	} else if ( code === 'http' ) {
		details = 'এইচটিটিপি ত্রুটি: ' + jqxhr.textStatus;
	} else if ( code === 'ok-but-empty' ) {
		details = 'ত্রুটি: সার্ভার থেকে একটি ফাঁকা প্রতিক্রিয়া এসেছে';
	} else {
		details = 'এপিআই ত্রুটি: ' + code;
	}
	return details;
};

/**
 * makeLink
 *
 * Makes a link to a bn.Wikipedia page that opens in a new tab/window.
 * 
 * @requires {Module} mediawiki.util
 * @param {string} linktarget
 *  The target page.
 * @param {string} linktext
 *  Text to display in the link. Optional, if not provided the target will be used.
 * @return {jQuery} jQuery object containing the `<a>` element.
 */
var makeLink = function(linktarget, linktext) {
	if ( linktext == null ) {
		linktext = linktarget;
	}
	return $('<a>').attr({
		'href': mw.util.getUrl(linktarget),
		'target':'_blank'
	}).text(linktext);
};

/* ========== Tasks ======================================================== */

// Grab page data - initial author, current wikitext, any redirects, if Draft:
// page already exists
var grabPageData = function() {

	var isNonSignificantEdit = function ( revision ) {
		//edits marked as minor
		if ( revision.minor === "" ) {
			return true;
		}

		if ( revision.anon === "" ) {
			return true;
		}
		
		const tagsToIgnore = [ "pagetriage", "mw-undo", "AWB", "twinkle",
			"shortdesc helper", "mw-manual-revert", "mw-undo", "mw-rollback",
			"mw-reverted", window.mtd.config.changeTags ];
		const intersectionArray = revision.tags.filter(
				(element) => tagsToIgnore.includes(element));
		if ( intersectionArray.length > 0 ) {
			return true;
		}
		return false;
	};

	/* ---------- Initial author ------------------------------------------- */

	/* Try making an api call for just the first revision - but if that is a
		redirect, then get 'max' number of revisions, and look for first
		non-redirect revision - use this as the initial author,	not the creator
		of the redirect.
	*/
	var processMaxRvAuthorQuery = function (result) {
		var revisions = result.query.pages[window.mtd.config.mw.wgArticleId].revisions;
		var patternForRedirect = /^\s*#redirect/i;

		// blanking the contributor array
		window.mtd.config.pagedata.contributors = {};
		window.mtd.config.pagedata.lastEditTimestamp = revisions[revisions.length - 1].timestamp;
		for ( let i = 0; i < revisions.length; i++ ) {
			if ( !patternForRedirect.test(revisions[i]["*"]) ) {
				if (window.mtd.config.pagedata.author === undefined) {
					window.mtd.config.pagedata.author = revisions[i].user;
					window.mtd.config.pagedata.creationTimestamp = revisions[i].timestamp;
				}

				// Find if there is a comment which indicates previous draftification
				if( revisions[i].comment.search(/moved page \[\[.*\]\] to \[\[Draft:/) !== -1) {
					window.mtd.config.pagedata.previousDraftification = true;
				}

				if( isNonSignificantEdit( revisions[i] ) ) {
					continue;
				}

				// Ignoring edits made by the current user
				// and non-significant edits (previous if condition)
				if( revisions[i].user !== window.mtd.config.mw.wgUserName ) {
					window.mtd.config.pagedata.lastEditTimestamp = revisions[i].timestamp;
				}

				// Calculating contribs per editor
				if (window.mtd.config.pagedata.contributors[revisions[i].user] === undefined) {
					window.mtd.config.pagedata.contributors[revisions[i].user] = 1;
				} else {
					window.mtd.config.pagedata.contributors[revisions[i].user]++;
				}
			}
		}
		// Check that we actually found an author (i.e. not all revisions were
		// redirects)
		if ( window.mtd.config.pagedata.author == null ) {
			window.API.abort();
			const retry = confirm("পাতা সম্পাদকের তথ্য বিশ্লেষণ করা যায়নি।\n\nআবার চেষ্টা করুন?");
			if ( retry ) {
				screen0();
			} else {
				$("#M2D-modal").remove();
			}
		}

		return removeBotsfromContributorList()
		.then( sortContributorsByEdits );
	};

	var removeBotsfromContributorList = function () {
		// Query to get bots from the contributor list
		return window.API.get( {
			action: "query",
			list: "users",
			ususers: Object.keys( window.mtd.config.pagedata.contributors ).join( "|" ),
			usprop: ["groups"]
		} )
		.then( function(result) {
			for ( let userResult of result.query.users ) {
				if ( userResult.groups.indexOf( "bot" ) > -1 ) {
					window.mtd.config.pagedata.contributors[ userResult.name ] = 0;
				}
			}
			return Promise.resolve();
		} );
	};

	var sortContributorsByEdits = function () {
		// temporary array to ease sorting
		let sortable = [];
		for ( let contributor in window.mtd.config.pagedata.contributors ) {
			if ( contributor !== window.mtd.config.mw.wgUserName ) {
				sortable.push({"c": contributor,
					"e": window.mtd.config.pagedata.contributors[contributor] });
			}
		}

		sortable.sort( function( a, b ) {
			// make sure that the page creator is on the top
			if( a.c === window.mtd.config.pagedata.author ) {
				return -100;
			}
			if( b.c === window.mtd.config.pagedata.author ) {
				return 100;
			}
			// sorting by number of edits
			return b.e - a.e;
		});

		window.mtd.config.pagedata.contributors = {};
		for ( let i in sortable ) {
			if ( i >= 5 || sortable[ i ].e < 1 ) {
				// only show the top 5 contributors with more than 0 edits
				break;
			}
			window.mtd.config.pagedata.contributors [ sortable[ i ].c ] = sortable[ i ].e;
		}
		return Promise.resolve();
	};

	var processAuthorQuery = function (result) {
		// Check if page is currently a redirect
		if ( result.query.pages[window.mtd.config.mw.wgArticleId].redirect ) {
			window.API.abort();
			alert("ত্রুটি: " + window.mtd.config.mw.wgPageName + " হলো একটি পুনর্নির্দেশ");
			return;
		}

		// query to look for first non-redirect revision
		return window.API.get( {
			action: "query",
			pageids: window.mtd.config.mw.wgArticleId,
			prop: "revisions",
			rvprop: ["user", "content", "timestamp", "comment", "flags", "tags"],
			rvlimit: "max",
			rvdir: "newer"
		} )
		.then( processMaxRvAuthorQuery )
		.catch( function( c, r ) {
			if ( r.textStatus === "abort" ) { return; }

			window.API.abort();
			const retry = confirm("পাতা সম্পাদকের তথ্য বিশ্লেষণ করা যায়নি:\n"+makeErrorMsg(c, r)+"\n\nআবার চেষ্টা করুন?");
			if ( retry ) {
				screen0();
			} else {
				$("#M2D-modal").remove();
			}
		} );
	};

	//Get contributor Data
	var getContributorData = function() {
		setTaskStatus( 0, "started" );
		return window.API.get( {
			action: "query",
			pageids: window.mtd.config.mw.wgArticleId,
			prop: ["revisions", "info"],
			rvprop: "content",
			rvlimit: 1,
			rvdir: "newer"
		} )
		.then( processAuthorQuery )
		.then( function() {
			setTaskStatus( 0, "done" );
			return Promise.resolve();
		})
		.catch( function( c, r ) {
			if ( r.textStatus === "abort" ) { return; }

			window.API.abort();
			const retry = confirm("পাতা সম্পাদকের তথ্য বিশ্লেষণ করা যায়নি:\n"+makeErrorMsg(c, r)+"\n\nআবার চেষ্টা করুন?");
			if ( retry ) {
				screen0();
			} else {
				$("#M2D-modal").remove();
			}
			return Promise.reject( "getContributorData failed!" );
		} );
	};

	/* ---------- Current wikitext ----------------------------------------- */
	var getCurrentWikiText = function() {
		setTaskStatus( 1, "started" );
		window.API.get( {
			action: "query",
			pageids: window.mtd.config.mw.wgArticleId,
			prop: "revisions",
			rvprop: "content"
		} )
		.then( function(result) {
			window.mtd.config.pagedata.oldwikitext = result.query.pages[window.mtd.config.mw.wgArticleId].revisions[0]["*"];
			setTaskStatus( 1, "done" );
			return Promise.resolve();
		} )
		.catch( function( c, r ) {
			if ( r.textStatus === "abort" ) { return; }

			window.API.abort();
			const retry = confirm("পাতার উইকিপাঠ্য তথ্য বিশ্লেষণ করা যায়নি:\n" +
				makeErrorMsg(c, r) + "\n\nআবার চেষ্টা করুন?"
				);
			if ( retry ) {
				screen0();
			} else {
				$("#M2D-modal").remove();
			}
			return Promise.reject( "getCurrentWikiText failed!" );
		} );
	};

	//TODO(?): also get proposed Draft: page (to check if it is empty or not)

	/* ---------- Redirects ------------------------------------------------ */
	var redirectTitles = [];

	var processRedirectsQuery = function(result) {
		if ( !result.query || !result.query.pages ) {
			// No results
			window.mtd.config.pagedata.redirects = false;
			return Promise.resolve();
		}

		// Gather redirect titles into array
		$.each(result.query.pages, function(_id, info) {
			redirectTitles.push(info.title);
		});

		// Continue query if needed
		if ( result.continue ) {
			doRedirectsQuery( result.continue );
			return Promise.resolve();
		}

		// Check if redirects were found
		if ( redirectTitles.length === 0 ) {
			window.mtd.config.pagedata.redirects = false;
			return Promise.resolve();
		}

		// Set redirects
		window.mtd.config.pagedata.redirects = redirectTitles;
		return Promise.resolve();
	};


	var doRedirectsQuery = function(extraQueryParam = null) {
		setTaskStatus( 2, "started" );

		const redirectsQuery = {
			action: "query",
			pageids: window.mtd.config.mw.wgArticleId,
			generator: "redirects",
			grdlimit: 500
		};

		return window.API.get( $.extend( redirectsQuery, extraQueryParam ) )
		.then( processRedirectsQuery )
		.then( function() {
			setTaskStatus( 2, "done" );
			return Promise.resolve();
		})
		.catch( function( c, r ) {
			if ( r.textStatus === "abort" ) { return; }

			window.API.abort();
			const retry = confirm("পুনর্নির্দেশ তথ্য বিশ্লেষণ করা যায়নি:\n" + makeErrorMsg(c, r) +
				"\n\nআবার চেষ্টা করুন? (বা উপেক্ষা করতে বাতিল করুন)");
			if ( retry ) {
				screen0();
			} else {
				window.mtd.config.pagedata.redirects = false;
				setTaskStatus( 2, "skipped" );
				return Promise.resolve();
			}
		} );
	};

	/* ---------- Review (Page Patrol) status ------------------------------ */
	var getPagePatrolStatus = function() {
	setTaskStatus(3, "started");

	return window.API.get({
		action: "query",
		prop: "revisions",
		rvprop: "user",
		rvlimit: 1,
		rvdir: "newer",
		pageids: window.mtd.config.mw.wgArticleId,
		list: "logevents", 
		letype: "patrol",
		leprop: "title",
		letitle: window.mtd.config.mw.wgPageName
	})
	.then(function(result) {

		if (result.query.logevents && result.query.logevents.length > 0) {
			var keepGoing = confirm("বিজ্ঞপ্তি: এই পাতাটি ইতিমধ্যে পরীক্ষিত বলে চিহ্নিত করা হয়েছে. আপনি কি এই পাতাটিকে খসড়ায় স্থানান্তরের বিষয়ে নিশ্চিত?");
			if (!keepGoing) {
				window.API.abort();
				$("#M2D-modal").remove();
				return Promise.resolve();
			}
		}

		var pageCreator = result.query.pages[window.mtd.config.mw.wgArticleId].revisions[0].user;

		return window.API.get({
			action: "query",
			list: "users",
			ususers: pageCreator,
			usprop: "groups"
		})
		.then(function(userResult) {
			if (userResult.query && userResult.query.users.length > 0) {
				var userGroups = userResult.query.users[0].groups;

				if (userGroups.includes("autopatrolled")) {
					var keepGoingAutopatrolled = confirm("বিজ্ঞপ্তি: এই পাতাটি একজন স্বয়ংক্রিয় পরীক্ষক ব্যবহারকারী দ্বারা তৈরি করা হয়েছে৷ আপনি কি এই পাতাটিকে খসড়ায় স্থানান্তরের বিষয়ে নিশ্চিত?");
					if (!keepGoingAutopatrolled) {
						window.API.abort();
						$("#M2D-modal").remove();
						return Promise.resolve();
					}
				}

				if (userGroups.includes("sysop")) {
					var keepGoingSysop = confirm("বিজ্ঞপ্তি: এই পাতাটি একজন প্রশাসক দ্বারা তৈরি করা হয়েছে৷ আপনি কি এই পাতাটিকে খসড়ায় স্থানান্তরের বিষয়ে নিশ্চিত?");
					if (!keepGoingSysop) {
						window.API.abort();
						$("#M2D-modal").remove();
						return Promise.resolve();
					}
				}
			}

			setTaskStatus(3, "done");
			return Promise.resolve();
		});
	})
	.catch(function(c, r) {
		if (r.textStatus === "abort") { return; }

		window.API.abort();
		const retry = confirm("পর্যালোচনার তথ্য বিশ্লেষণ করা যায়নি:\n" + makeErrorMsg(c, r) + "\n\nআবার চেষ্টা করুন?");
		if (retry) {
			screen0();
		} else {
			$("#M2D-modal").remove();
		}
		return Promise.reject("getPagePatrolStatus failed!");
	});
};
	
	const promises = [];
	promises.push( getContributorData() );
	promises.push( getCurrentWikiText() );
	promises.push( doRedirectsQuery() );
	promises.push( getPagePatrolStatus() );

	Promise.allSettled( promises )
		.then( showContributorScreen )
		.catch( console.log.bind( console ) );
};

//Sets the status of tasks in the progress screen
var setTaskStatus = function( taskNumber, status, extraText ) {
	var timeTaken;
	if( taskNumber < 0 || taskNumber > 6 ) {
		//Invalid tasknumber
		return;
	}

	switch ( status ) {
		case "started":
			$( "#M2D-task" + taskNumber ).css( { "color": "#00F", "font-weight": "bold" } );
			$( "#M2D-status" + taskNumber ).text( "প্রক্রিয়াধীন" );
			//Set the start time
			window.mtd.config.processTimer[ taskNumber ] = new Date();
			break;
		case "done":
			$( "#M2D-task" + taskNumber ).css( { "color": "#000", "font-weight": "" } );
			$( "#M2D-status" + taskNumber ).html( "&check;" );
			$( "#M2D-status" + taskNumber ).css( "color", "green" );
			timeTaken = (new Date()) - window.mtd.config.processTimer[ taskNumber ];
			break;
		case "skipped":
			$( "#M2D-task" + taskNumber ).css( { "color": "#F00", "font-weight": "" } );
			$( "#M2D-status" + taskNumber ).text( "Skipped!" );
			break;
	}

	if ( extraText !== undefined && extraText !== "" ) {
		$( "#M2D-status" + taskNumber ).append( " (" + extraText + ")" );
	}
	if ( timeTaken !== undefined ) {
		$( "#M2D-status" + taskNumber ).append( 
			$('<span>').append( " (" + timeTaken + "ms)" )
				.css('color', 'rgba(0, 0, 0, 0.4)')
		);
	}
};

//Check if redirectsuppression is allowed
var isRedirectSuppressionAllowed = function() {
	//Only local sysops and reviewers of Bangla Wikipedia are allowed to suppress redirects
	return ( window.mtd.config.mw.wgUserGroups.includes( "sysop" ) ||
		window.mtd.config.mw.wgUserGroups.includes( "reviewer" ) );
};

//Move page
var movePage = function() {
	setTaskStatus( 0, "started" );

	// First check the page hasn't been draftified in the meantime
	return window.API.get({
		action: "query",
		pageids: window.mtd.config.mw.wgArticleId,
		format: "json",
		formatversion: "2"
	}).then(function(response) {
		var page = response && response.query && response.query.pages &&
			response.query.pages[0];
		if (!page) {
			return $.Deferred().reject();
		} else if (page.missing) {
			return $.Deferred().reject("moveToDraft-pagemissing");
		} else if (page.ns === 118 /* Draft NS */) {
			return $.Deferred().reject("moveToDraft-alreadydraft");
		} else if (page.ns !== window.mtd.config.mw.wgNamespaceNumber) {
			return $.Deferred().reject("moveToDraft-movednamespace");
		}

		return window.API.postWithToken( "csrf", {
			action: "move",
			fromid: window.mtd.config.mw.wgArticleId,
			to: window.mtd.config.inputdata.newTitle,
			movetalk: 1,
			noredirect: isRedirectSuppressionAllowed(),
			reason: window.mtd.config.inputdata.rationale + " " +
				window.mtd.config.draftReasonsShort,
			tags: window.mtd.config.changeTags
		} );
	})
	.then( function() {
		setTaskStatus( 0, "done" );
		return Promise.resolve();
	} )
	.catch( function( c, r ) {
		if ( r && r.textStatus === "abort" ) {
			return;
		} else if (c === "moveToDraft-pagemissing") {
			alert( "পাতাটি আর বিদ্যমান বলে মনে হচ্ছে না। এটা সম্ভবত অপসারিত হয়েছে।" );
			$( "#M2D-modal" ).remove();
			window.location.reload();
			return;
		} else if (c === "moveToDraft-alreadydraft") {
			alert( "বাতিল করা হয়েছে: পাতাটি ইতিমধ্যেই খসড়ায় নেওয়া হয়েছে।" );
			$( "#M2D-modal" ).remove();
			window.location.reload();
			return;
		}

		const retry = confirm( "পাতা স্থানান্তর করা যায়নি:\n"
			+ makeErrorMsg( c, r )
			+ "\n\nআবার চেষ্টা করুন ?" );
		if ( retry ) {
			return movePage();
		} else {
			showOptionsScreen(true);
			return Promise.reject( "স্থানান্তর ব্যর্থ!" );
		}
	} );
};

var tagRedirect = function() {
	setTaskStatus( 6, "started" );
	if ( isRedirectSuppressionAllowed () ) {
		setTaskStatus( 6, "skipped" );
		return Promise.resolve();
	}

	return window.API.postWithToken( "csrf", {
		action: "edit",
		title: window.mtd.config.mw.wgPageName,
		prependtext: '{{Db-r2}}\n',
		summary: '[[WP:প২|প২]] দ্রুত অপসারণ প্রস্তাবনা (নিবন্ধ খসড়ায় স্থানান্তরিত)',
		tags: window.mtd.config.changeTags
	} )
	.then( function() {
		// This null edit is needed until https://phabricator.wikimedia.org/T321192 is fixed
		return window.API.postWithToken( 'csrf', {
			action: 'edit',
			title: window.mtd.config.mw.wgPageName,
			prependtext: '',
			summary: 'শূন্য সম্পাদনা',
			tags: window.mtd.config.changeTags
		} );
	} )
	.then( function() {
		setTaskStatus( 6, "done" );
		return Promise.resolve();
	} )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) { return; }

		const retry = confirm( "পুনর্নির্দেশ দ্রুত অপসারণের ট্যাগ করা যায়নি:\n"+
			makeErrorMsg(c, r) + "\n\nআবার চেষ্টা করুন ?" );
		if ( retry ) {
			return tagRedirect();
		} else {
			setTaskStatus( 6, "skipped" );
			return Promise.resolve();
		}
	} );
};

//Find which images are non-free
var getImageInfo = function() {
	setTaskStatus( 1, "started" );

	var processImageInfo = function( result ) {
		var nonFreeFiles = [];
		if ( result && result.query ) {
			$.each(result.query.pages, function( id, page ) {
				if ( id > 0 && page.categories ) {
					nonFreeFiles.push( page.title );
				}
			});
		}

		setTaskStatus( 1, "done", nonFreeFiles.length + " found" );
		return Promise.resolve( nonFreeFiles );
	};

	return window.API.get( {
		action: "query",
		pageids: window.mtd.config.mw.wgArticleId,
		generator: "images",
		gimlimit: "max",
		prop: "categories",
		cllimit: "max",
		clcategories: "বিষয়শ্রেণী:সকল অ-মুক্ত মিডিয়া",
	} )
	.then( function(result){
		return processImageInfo( result );
	} )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) {
			return Promise.resolve( [] );
		}

		const retry = confirm("অমুক্ত চিত্র আছে কিনা তা পাওয়া যায়নি:\n"+ makeErrorMsg(c, r)+"\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
		if ( retry ) {
			return getImageInfo();
		} else {
			setTaskStatus( 1, "skipped" );
			return Promise.resolve( [] );
		}
	} );

};

//Comment out non-free files, turn categories into links, add afc draft template, list any redirects
var editWikitext = function( nonFreeFiles ) {
	setTaskStatus( 2, "started" );

	var redirectsList = ( !window.mtd.config.pagedata.redirects ) ? "" : "\n"+
		"<!-- Note: The following pages were redirects to [[" + window.mtd.config.mw.wgPageName +
		"]] before draftification:\n" +
		"*[[" + window.mtd.config.pagedata.redirects.join("]]\n*[[") + "]]\n-->\n";

	var wikitext = "{{subst:AFC draft|" + window.mtd.config.pagedata.author + "}}\n" +
	redirectsList +
	window.mtd.config.pagedata.oldwikitext
		.replace(/(\[\[\s*বিষয়শ্রেণী\s*:[^\]]+\]\])+/g,
		"{{খসড়া বিষয়শ্রেণী|\n$1\n}}\n");

	// non-free files
	//  (derived from [[WP:XFDC]] - https://en.wikipedia.org/wiki/User:Evad37/XFDcloser.js )
	if ( nonFreeFiles.length > 0 ) {
		// Start building regex strings
		var normalRegexStr = "(";
		var galleryRegexStr = "(";
		var freeRegexStr = "(";
		for (let i=0; i<nonFreeFiles.length; i++ ) {
			// Take off namespace prefix
			const filename = nonFreeFiles[i].replace(/^.*?:/, "");
			// For regex matching: first character can be either upper or lower case, special
			// characters need to be escaped, spaces can be either spaces or underscores
			const filenameRegexStr = "[" + mw.util.escapeRegExp(filename.slice(0, 1).toUpperCase()) +
			mw.util.escapeRegExp(filename.slice(0, 1).toLowerCase()) + "]" +
			mw.util.escapeRegExp(filename.slice(1)).replace(/ /g, "[ _]");
			// Add to regex strings
			normalRegexStr += "\\[\\[\\s*(?:[Ii]mage|[Ff]ile)\\s*:\\s*" + filenameRegexStr +
			"\\s*\\|?.*?(?:(?:\\[\\[.*?\\]\\]).*?)*\\]\\]";
			galleryRegexStr += "^\\s*(?:[Ii]mage|[Ff]ile):\\s*" + filenameRegexStr + ".*?$";
			freeRegexStr += "\\|\\s*(?:[\\w\\s]+\\=)?\\s*(?:(?:[Ii]mage|[Ff]ile):\\s*)?" +
			filenameRegexStr;

			if ( i+1 === nonFreeFiles.length ) {
				normalRegexStr += ")(?![^<]*?-->)";
				galleryRegexStr += ")(?![^<]*?-->)";
				freeRegexStr += ")(?![^<]*?-->)";
			} else {
				normalRegexStr += "|";
				galleryRegexStr += "|";
				freeRegexStr += "|";
			}
		}

		// Check for normal file usage, i.e. [[File:Foobar.png|...]]
		var normalRegex = new RegExp( normalRegexStr, "g");
		wikitext = wikitext.replace(normalRegex, "<!-- Commented out: $1 -->");

		// Check for gallery usage, i.e. instances that must start on a new line, eventually
		// preceded with some space, and must include File: or Image: prefix
		var galleryRegex = new RegExp( galleryRegexStr, "mg" );
		wikitext = wikitext.replace(galleryRegex, "<!-- Commented out: $1 -->");

		// Check for free usages, for example as template argument, might have the File: or Image:
		// prefix excluded, but must be preceeded by an |
		var freeRegex = new RegExp( freeRegexStr, "mg" );
		wikitext = wikitext.replace(freeRegex, "<!-- Commented out: $1 -->");
	}

	return window.API.postWithToken( "csrf", {
		action: "edit",
		pageid: window.mtd.config.mw.wgArticleId,
		text: wikitext,
		summary: window.mtd.config.wikitext.editsummary,
		tags: window.mtd.config.changeTags
	} )
	.then( function(){
		setTaskStatus( 2, "done" );
		return Promise.resolve();
	} )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) {
			return Promise.resolve();
		}

		const retry = confirm("খসড়া নিবন্ধ সম্পাদনা করা যায়নি:\n"+ makeErrorMsg(c, r)+"\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
		if ( retry ) {
			editWikitext(nonFreeFiles);
		} else {
			setTaskStatus( 2, "skipped" );
			return Promise.resolve();
		}
	} );
};

var notifyContributors = function() {
	if(window.mtd.config.pagedata.notifyList.length === 0 ||
			!window.mtd.config.inputdata.notifyEnable ) {
		setTaskStatus( 3, "skipped" );
		return Promise.resolve();
	}
	setTaskStatus( 3, "started" );

	const promises = [];
	for ( let i in window.mtd.config.pagedata.notifyList ) {
		promises.push( notifyContributor( window.mtd.config.pagedata.notifyList[i] ) );
	}

	return Promise.allSettled( promises )
		.then( function () {
			setTaskStatus( 3, "done" );
			return Promise.resolve();
		} );
};

var notifyContributor = function( contributor ) {
	return window.API.postWithToken( "csrf", {
		action: "discussiontoolsedit",
		page: "User talk:" + contributor,
		paction: "addtopic",
		sectiontitle: window.mtd.config.inputdata.notifyMsgHead,
		wikitext: window.mtd.config.inputdata.notifyMsg,
		tags: window.mtd.config.changeTags
	} )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) {
			return Promise.resolve();
		}

		const retry = confirm("ব্যবহারকারী আলাপ পাতা সম্পাদনা করা যায়নি:\n"+ makeErrorMsg(c, r)+"\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
		if ( retry ) {
			return notifyContributor( contributor );
		}
		return Promise.resolve();
	} );
};

var updateTalk = function() {
	setTaskStatus( 4, "started" );

	//if page exists, do a regex search/repace for class/importances parameters
	var processTalkWikitext = function(result) {
		var talkPageId = result.query.pageids[0];
		if ( talkPageId < 0 ) {
			setTaskStatus( 4, "done", "আলাপ পাতা বিদ্যমান নেই" );
			return Promise.resolve();
		}
		var oldTalkWikitext = result.query.pages[talkPageId].revisions[0]["*"];
		var newTalkWikitext = oldTalkWikitext.replace(/(\|\s*(?:class|importance)\s*=\s*)[^|}]*(?=[^}]*\}\})/g, "$1");
		if ( newTalkWikitext === oldTalkWikitext ) {
			setTaskStatus( 4, "done", "কোনো পরিবর্তনের প্রয়োজন নেই" );
			return Promise.resolve();
		}

		return window.API.postWithToken( "csrf", {
			action: "edit",
			pageid: talkPageId,
			section: "0",
			text: newTalkWikitext,
			summary: 'প্রকল্প ব্যানার থেকে শ্রেণী/গুরুত্ব/মান অপসারণ',
			tags: window.mtd.config.changeTags
		} )
		.then( function(){
			setTaskStatus( 4, "done" );
			return Promise.resolve();
		} )
		.catch( function( c, r ) {
			if ( r.textStatus === "abort" ) {
				return Promise.resolve();
			}

			const retry = confirm("খসড়ার আলাপ পাতা সম্পাদনা করা যায়নি:\n"
				+ makeErrorMsg(c, r)
				+ "\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
			if ( retry ) {
				return updateTalk();
			} else {
				setTaskStatus( 4, "skipped" );
				return Promise.resolve();
			}
		} );
	};

	//get talk page wikitext (section 0)
	return window.API.get( {
		action: "query",
		titles: window.mtd.config.inputdata.newTitle.replace("খসড়া:", "খসড়া আলোচনা:"),
		prop: "revisions",
		rvprop: "content",
		rvsection: "0",
		indexpageids: 1
	} )
	.then( processTalkWikitext )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) {
			return Promise.resolve();
		}

		const retry = confirm("খসড়ার আলাপ পাতা খুঁজে পাওয়া যায়নি:\n"
			+ makeErrorMsg(c, r)
			+ "\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
		if ( retry ) {
			return updateTalk();
		} else {
			setTaskStatus( 4, "skipped" );
			return Promise.resolve();
		}
	} );
};

var logDraftification = function() {
	if (window.mtd.config.doNotLog) {
		setTaskStatus( 5, "skipped" );
		return Promise.resolve();
	}

	setTaskStatus( 5, "started" );
	var logpage = "User:" + window.mtd.config.mw.wgUserName + "/খসড়া_লগ";
	var monthNames = window.mtd.config.mw.wgMonthNames.slice(1);
	var now = new Date();
	var heading = monthNames[now.getUTCMonth()] + " " +
			now.getUTCFullYear();

	// Get a list of sections of a page
	var getSections = function( pageTitle ) {
		return window.API.get( {
			action: "parse",
			page: pageTitle,
			redirects: 1,
			prop: "sections"
		});
	};

	// Check if page exists
	var doesPageExist = function( pageTitle ) {
		return window.API.get( {
			action: "query",
			titles: pageTitle,
			prop: "revisions",
			redirects: 1,
			rvlimit: 1,
			indexpageids: 1
		} )
		.then ( function( result ) {
			var id = result.query.pageids[0];
			return Promise.resolve( id >= 0 );
		} );
	};

	// Search within the result for the current month's heading
	var searchSectionsForText = function( result, heading ) {
		var sections = result.parse.sections;

		if ( sections.length > 18 ) {
			console.log( "আপনার খসড়াভুক্তির লগ ফাইল বড়। " +
				"পুরনো লগসমূহ বছর অনুযায়ী সংরক্ষণের জন্য বিবেচনা করুন।" );
		}

		for ( let i = sections.length - 1; i >= 0; i-- ) {
			if ( sections[i].line === heading ) {
				// Found the current month's section
				return sections[i].index;
			}
		}
		return -1;
	};
	
	var queryParams;
	return doesPageExist( logpage )
	.then ( function( result ) {
		var editSummary = '[[' + window.mtd.config.inputdata.newTitle + ']] এর লগ রাখা হয়েছে (' +
							window.mtd.config.draftReasonsShort + ')';
		if ( result ) {
			return getSections( logpage )
			.then ( function( result ) {
				const sectionNumber = searchSectionsForText( result, heading );
				if ( sectionNumber === -1 ) {
					// Section for current month needs to be created
					queryParams = {
						text: window.mtd.config.inputdata.logMsg,
						section: "new",
						sectiontitle: heading,
						summary: editSummary + ' (new month)',
					};
				} else {
					// Append log line to current month's section
					queryParams = {
						appendtext: "\n" + window.mtd.config.inputdata.logMsg,
						section: sectionNumber,
						summary: editSummary,
					};
				}
			} );
		} else {
			// Draftify_log page does not exist
			var createlog = confirm("খসড়া স্থানান্তরের লগ (" +  logpage + " এ) রাখবেন?");
			if ( !createlog ) {
				setTaskStatus( 5, "skipped" );
				return Promise.resolve();
			}
			const logpageWikitext = "এটি [[User:Tanbiruzzaman/MoveToDraft|MoveToDraft]] স্ক্রিপ্ট ব্যবহার করে খসড়া নামস্থানে স্থানান্তরিত পাতাগুলোর একটি লগ।"
					+ "\n\n==" + heading + "==\n" + window.mtd.config.inputdata.logMsg;

			queryParams = {
				prependtext: logpageWikitext,
				summary: editSummary + ' (প্রথম খসড়া)',
				nocreate: false
			};
			return Promise.resolve();
		}
	} )
	.then( () => {
		queryParams = $.extend({
				action: "edit",
				redirect: 1,
				title: logpage,
				tags: window.mtd.config.changeTags
			},
			queryParams );
		return window.API.postWithToken( "csrf", queryParams );
	} )
	.then( function(){
		setTaskStatus( 5, "done" );
		return Promise.resolve();
	} )
	.catch( function( c, r ) {
		if ( r.textStatus === "abort" ) {
			return Promise.resolve();
		}

		const retry = confirm("লগ পাতা সম্পাদনা করা যায়নি:\n" + makeErrorMsg(c, r) + "\n\nআবার চেষ্টা করতে [ঠিক আছে], বা উপেক্ষা করতে [বাতিল] চাপুন");
		if ( retry ) {
			return logDraftification();
		} else {
			setTaskStatus( 5, "skipped" );
			return Promise.resolve();
		}
	} );
};

var setupHeader = function(subText) {
	$("#M2D-interface-header").append(
		$("<button>").text("X")
			.attr('title', 'বন্ধ করুন')
			.css('float', 'right')
			.click(function(){
				$("#M2D-modal").remove();
			}),
		$('<div>')
			.append(
				makeLink(window.mtd.config.script.location, 'খসড়ায় স্থানান্তর'),
				' <small>(v' + window.mtd.config.script.version + ')</small>',
				subText
			)
			.css({"font-weight": "bold", "font-size": "large",
					"margin": "0.25em", "text-align": "center"})
	);
};


var notifyChange = function() {
	$('#M2D-option-message-head').prop('disabled', !this.checked);
	for (let key in window.mtd.config.draftReasons) {
		$("#M2D-option-reasons-checkbox-"+key).prop("disabled", !this.checked);
	}
	$("#M2D-option-reasons-checkbox-other").prop("disabled", !this.checked);
	$("#M2D-reason-other").prop("disabled", !this.checked);

	if (this.checked) {
		$('#M2D-option-message-preview-outer').show();
	} else {
		$('#M2D-option-message-preview-outer').hide();
	}
};

// --- Interface screens ---
//0) Initial screen
var screen0 = function() {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	setupHeader("...");

	$("#M2D-interface-content").text("তথ্য সংগ্রহ করা হচ্ঝে...");
	$("#M2D-interface-content").append(
		getProgressTasks(
			[	'অবদানকারীদের তথ্য নেওয়া হচ্ছে',
				'বর্তমান উইকিপাঠ্য পড়া হচ্ছে',
				'পুনর্নির্দেশ খোঁজা হচ্ছে',
				'নিরীক্ষণ অবস্থা বিশ্লেষণ হচ্ছে'
			] )
	);

	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-abort').text('অসম্পূর্ণ কাজ বাতিল করুন'),
		$('<span>').attr('id', 'M2D-finished').hide().append(
			'সম্পন্ন!',
			$('<button>').attr('id', 'M2D-close').text('বন্ধ করুন')
				.css('margin-left', '0.5em')
		)
	);

	$("#M2D-close").click( function(){
		$("#M2D-modal").remove();
		window.location.reload();
	} );
	grabPageData();
};

//1) Contributors
var showContributorScreen = function() {

	var numContributors = Object.keys(window.mtd.config.pagedata.contributors).length;
	if( numContributors === 0) {
		console.log("কোন অবদানকারী নেই");

		//show next screen
		showOptionsScreen();
		return;
	} else if( numContributors === 1) {
		console.log("শুধুমাত্র একজন অবদানকারী। পরবর্তী স্ক্রিনে নেওয়া হচ্ছে");

		const singleContributor = Object.keys(window.mtd.config.pagedata.contributors)[0];
		window.mtd.config.pagedata.notifyList = [ singleContributor ];

		//show next screen
		showOptionsScreen();
		return;
	}

	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	setupHeader(": অবদানকারীগন");

	$("#M2D-interface-content").append(
			$('<div>')
				.css('padding-bottom', '1em')
				.append(
					$('<a>').attr({
							'href': '?action=history',
							'target':'_blank'
						}).text("পাতার ইতিহাস দেখুন")
			),
			$('<div>')
				.css('padding-bottom', '0.5em')
				.text("বিজ্ঞপ্তি পাঠানোর জন্য অবদানকারী বাছাই করুন: ")
		)
		.css('margin', '1em');

	for ( const [key, edits] of Object.entries( window.mtd.config.pagedata.contributors ) ) {
		var contributor = `${key}`;
		var contributorForDivId = contributor.replace(/\W/g, "_");

		$('#M2D-interface-content').append(
			$('<div>').append(
				$('<input>').attr({'id':'M2D-option-authors-checkbox-'+contributorForDivId,
						'name':'contributors', 'type':'checkbox', 'value':contributor}),
				$('<label>').attr({'id':'M2D-option-authors-label-'+contributorForDivId,
						'for':'M2D-option-authors-checkbox-'+contributorForDivId})
					.text(`${key}`+" - "+`${edits}`+" edit" + ((`${edits}`!==`1`)?"s":"") )
					.css({'margin-left':'0.5em'}),
				$('<br/>')
			)
		);

		if( contributor === window.mtd.config.pagedata.author ) {
			$('#M2D-option-authors-label-'+contributorForDivId).append(' (পাতা প্রণেতা)');
		}

		if( window.mtd.config.pagedata.notifyList.includes( contributor ) ) {
			$('#M2D-option-authors-checkbox-'+contributorForDivId).prop('checked', true);
		}
	}

	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-next').text('পরবর্তী'),
		$('<button>').attr('id', 'M2D-cancel').css('margin-left','3em').text('বাতিল')
	);

	$("#M2D-cancel").click(function(){
		$("#M2D-modal").remove();
	});

	$("#M2D-next").click(function(){
		var markedCheckboxes = document.querySelectorAll('input[name="contributors"]:checked');
		window.mtd.config.pagedata.notifyList = [];
		for (let checkbox of markedCheckboxes ) {
			window.mtd.config.pagedata.notifyList.push( checkbox.value );
		}

		//show next screen
		showOptionsScreen();
	});
};


//2) User inputs
/**
 * 
 * @param {boolean} restoreValues Restore previously set values
 */
var showOptionsScreen = function(restoreValues) {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	setupHeader(": পছন্দসমূহ");

	$("#M2D-interface-content").append(
		$('<div>').css('margin-bottom','0.5em').append(
			$('<div>')
			.attr({'id': 'M2D-warning'})
			.css({
				display: 'block',
				color: 'darkblue',
				'font-weight': 'bold',
			}).append(
				'অনুগ্রহ করে নিশ্চিত করুন যে স্থানান্তর প্রক্রিয়াটি নীতিমালা অনুযায়ী হচ্ছে কিনা, আরও জানতে দেখুন ',
				makeLink("WP:DRAFTIFY")
			),
			$('<div>')
					.css({ display: 'block', color: 'blue', 'font-style': 'italic', margin: '0.5em auto'})
					.append(
						'আপনি প্রথমে রক্ষণাবেক্ষণ ট্যাগ যোগ করতে পারেন, তারপর এই নিবন্ধটির সাথে সমস্যাগুলির সাথে মেলে এমন যেকোনো বা সমস্ত বাক্সে টিক চিহ্ন দিন, তারপর বার্তাটি জমা দিন৷'
					),
			$('<label>').attr('for','M2D-option-newtitle').append(
				'স্থানান্তর শিরোনাম, ',
				$('<b>').text('খসড়া:')
			),
			$('<input>').attr({'type':'text', 'name':'M2D-option-newtitle', 'id':'M2D-option-newtitle'})
				.css({'margin-left': '0.25em',
						'width': '25em'})
		),

		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr({'for':'M2D-option-movelog', 'id':'M2D-option-movelog-label'})
				.html('<b>স্থানান্তরের কারণ (লগ সারাংশ):</b>'),
			$('<input>').attr({'type':'text', 'name':'M2D-option-movelog', 'id':'M2D-option-movelog'})
				.css({'width':'44em', 'margin-left':'0.25em',
					'background-color': '#e8e8e8',
					'border': '1px solid #808080'})
		),

		$('<div>').attr({'id':'M2D-option-author'}).append(
			$('<input>').attr({'type':'checkbox', 'id':'M2D-option-message-enable'})
				.css('margin-right', '0.25em')
				.prop('checked', true),
			$('<label>').attr({'for':'M2D-option-message-enable'}).append(
				$('<b>').text( 'অবদানকারীদের বিজ্ঞপ্তি দিন: '))
		).css('margin-bottom', '0.5em'),

		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr({'for':'M2D-option-message-head', 'id':'M2D-option-message-head-label'})
				.css({'margin-top':'0.5em'}).append(
					$('<b>').text('বিজ্ঞপ্তি শিরোনাম:')
				),
			$('<input>').attr({'id':'M2D-option-message-head', 'type':'text'})
				.css({'width':'50em', 'margin-left':'0.25em',
					'background-color': '#e8e8e8',
					'border': '1px solid #808080'})
		),

		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr({'id':'M2D-option-reasons-label'})
				.css({'margin-top':'0.5em'}).append(
					$('<b>').text('কারণ:')
				),
			$('<div>').attr({'id':'M2D-option-reasons'})
				.css({'width':'99%', 'columns': '2'}),

			$('<div>').attr({'id':'M2D-option-reasons-other'})
				.css({'width':'99%', 'margin-bottom':'0.5em'})
		),

		$('<div>').attr({'id':'M2D-option-message-preview-outer'}).append(
			$('<label>').attr({'for':'M2D-option-message-preview', 'id':'M2D-option-message-label'})
				.css({'display':'block', 'font-weight':'bold'})
				.text('বিজ্ঞপ্তির পূর্বরূপ:'),
			$('<div>').attr({'id':'M2D-option-message-preview'})
				.css({'width': '98%', 'background': '#fff',
					'border': '1px solid #0002', 'padding': '0 0.5em'})
		)
	);

	for (let key in window.mtd.config.draftReasons) {
		$("#M2D-option-reasons").append(
			$('<div>').append(
				$('<input>').attr({'id':'M2D-option-reasons-checkbox-'+key, 'type':'checkbox', 'value':key})
					.change( reasonChange ),
				$('<label>').attr({'id':'M2D-option-reasons-label-'+key, 'for':'M2D-option-reasons-checkbox-'+key})
					.text(window.mtd.config.draftReasons[key].long.charAt(0).toUpperCase() + window.mtd.config.draftReasons[key].long.slice(1))
					.css({'margin-left':'0.5em'}),
				$('<br/>')
			)
		);
	}

	//text box and label
	$("#M2D-option-reasons-other").append(
		$('<input>').attr({'id':'M2D-option-reasons-checkbox-other', 'type':'checkbox', 'value':'other'})
			.css({'float':'left'}),
		$('<label>').attr({'for':'M2D-reason-other', 'id':'M2D-reason-other-label'})
			.css({'float':'left', 'margin':'auto 0.5em'}).text('অন্যান্য/অতিরিক্ত কারণ:'),
		$('<textarea>').attr({'id':'M2D-reason-other', 'rows':'1'})
			.css({'width':'75%'})
			.on("input keyup paste", reasonChange )
	);

	//Adding a warning, if needed
	setDraftifyWarning("#M2D-warning");

	//Setting one of the checkboxes as checked by default
	$('#M2D-option-reasons-checkbox-0').prop('checked', true);

	$('#M2D-option-movelog').val(window.mtd.config.wikitext.rationale);
	$('#M2D-option-newtitle').val(getPageText(window.mtd.config.mw.wgPageName)).change(function() {
		$('#M2D-option-message-head').val(
			$('#M2D-option-message-head').val().trim()
			.replace(/\[\[Draft:.*?\|/, "[[খসড়া:" + $('#M2D-option-newtitle').val().trim() + "|" )
		);
		window.mtd.config.notificationMessage = 
			window.mtd.config.notificationMessage.trim()
			.replace(/\[\[Draft:.*?\|/, "[[খসড়া:" + $('#M2D-option-newtitle').val().trim() + "|" );
	});

	$('#M2D-option-message-enable').change(notifyChange);

	if (window.mtd.config.pagedata.notifyList.length === 0) {
		$("#M2D-option-author").append( " কোনো অবদানকারী নেই ");
		$("#M2D-option-message-enable").prop("checked", false);
		$("#M2D-option-message-enable").prop("disabled", true);
		notifyChange();
	} else {
		$("#M2D-option-author").append(
			" " + window.mtd.config.pagedata.notifyList.toString().replace(/,/g, ", ") + " "
		);
	}

	if( Object.keys(window.mtd.config.pagedata.contributors).length > 1) {
		$("#M2D-option-author").append(
			$('<a>').text("পরিবর্তন")
				.click(showContributorScreen)
		);
	}

	$('#M2D-option-message-head').val(
		window.mtd.config.wikitext.notificationHeading.replace(/\$1/g, getPageText(window.mtd.config.mw.wgPageName))
	);
	reasonChange();

	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-next').text('চালিয়ে যান'),
		$('<button>').attr('id', 'M2D-cancel').css('margin-left','3em').text('বাতিল')
	);

	$("#M2D-cancel").click(function(){
		$("#M2D-modal").remove();
	});

	if (restoreValues) {
		$( '#M2D-option-movelog' ).val( window.mtd.config.inputdata.rationale );
		$( '#M2D-option-newtitle' ).val( window.mtd.config.inputdata.newTitle.replace( "খসড়া:", "" ) );
		$( '#M2D-option-author' ).val( window.mtd.config.inputdata.authorName );
		$( '#M2D-option-message-enable' ).prop( 'checked', window.mtd.config.inputdata.notifyEnable );
		$( '#M2D-option-message-head' ).val( window.mtd.config.inputdata.notifyMsgHead );
		window.mtd.config.notificationMessage = window.mtd.config.inputdata.notifyMsg;
	}


	$("#M2D-next").click(function(){
		//Gather inputs
		window.mtd.config.inputdata = {
			rationale:		$('#M2D-option-movelog').val().trim(),
			newTitle:		"খসড়া:" + $('#M2D-option-newtitle').val().trim(),
			authorName:		$('#M2D-option-author').val().trim(),
			notifyEnable:	$('#M2D-option-message-enable').prop('checked'),
			notifyMsgHead:	$('#M2D-option-message-head').val().trim(),
			notifyMsg:		window.mtd.config.notificationMessage.trim()
		};
		window.mtd.config.inputdata.logMsg = window.mtd.config.wikitext.logMsg
			.replace(/\$1/g, getPageText(window.mtd.config.mw.wgPageName))
			.replace(/\$2/g, window.mtd.config.inputdata.newTitle)
			+ ' (' + window.mtd.config.draftReasonsShort + ')';

		//Verify inputs
		var errors=[];
		if ( window.mtd.config.inputdata.newTitle.length === 0 ) {
			errors.push("অবৈধ খসড়া শিরোনাম");
		}

		if ( window.mtd.config.inputdata.rationale.length === 0 ) {
			errors.push("স্থানান্তর লগের কারণ ফাঁকা");
		}
		if ( window.mtd.config.inputdata.notifyEnable ) {
			if ( window.mtd.config.inputdata.notifyMsgHead.length === 0 ) {
				errors.push("বিজ্ঞপ্তি শিরোনাম ফাঁকা");
			}
			if ( window.mtd.config.inputdata.notifyMsg.length === 0 ) {
				errors.push("বিজ্ঞপ্তি বার্তা ফাঁকা");
			}
		}
		if ( errors.length >= 1 ) {
			alert("Error:\n\n" + errors.join(";\n"));
			return;
		}

		//start process off
		showProgressScreen();
		startTheProcess();
	});
};

var startTheProcess = function() {
	movePage()
		.then( getImageInfo )
		.then( function ( nonFreeFiles ) {
			const promises = [];
			promises.push( editWikitext( nonFreeFiles ) );
			promises.push( notifyContributors() );
			promises.push( updateTalk() );
			promises.push( logDraftification() );
			promises.push( tagRedirect() );
			return Promise.allSettled( promises );
		} )
		.then( function() {
				$("#M2D-finished, #M2D-abort").toggle();
				setTimeout( function () {
					window.location.reload();
				}, 2000 );
			}
		)
		.catch( console.log.bind( console ) );
};

//Checks if draftification is appropriate and warns the user accordingly
var setDraftifyWarning = function( divId ) {
	var now = new Date();

	var articleCreatedOn = new Date( window.mtd.config.pagedata.creationTimestamp );
	var articleAgeInDays = Math.round( ( now - articleCreatedOn ) / ( 1000 * 60 * 60 * 24 ) );

	var articleEditedOn = new Date( window.mtd.config.pagedata.lastEditTimestamp );
	var lastEditAgeInMinutes = Math.round( ( now - articleEditedOn ) / ( 1000 * 60 ) );
	var extraText = '';

	if ( window.mtd.config.pagedata.previousDraftification ) {
		extraText = ", কারণ পাতাটি আগে খসড়াভুক্ত হয়েছিল।";
	} else if ( articleAgeInDays > window.mtd.config.maximumAgeInDays ) {
		extraText = ", কারণ পাতাটি " + 
			window.mtd.config.maximumAgeInDays +
			" দিনের চেয়েও বেশি পুরনো।";
	} else if ( lastEditAgeInMinutes < window.mtd.config.minimumAgeInMinutes ) {
		extraText = ", কারণ পাতাটি " +
			window.mtd.config.minimumAgeInMinutes +
			" মিনিটের মধ্যে সম্পাদনা করা হয়েছে।";
	} else {
		return;
	}

	$(divId).text( '' )
		.css( { "color": "red", "font-size": "large" } );
	$(divId).append(
		makeLink( "WP:DRAFTIFY" ),
		" অনুযায়ী এই পাতাটি খসড়ায় স্থানান্তর উচিত হবেনা",
		extraText
	);
};

//Called when the state of any of the reason checkboxes changes
var reasonChange = function() {
	var reasons = [];
	var reasonsShort = [];
	for (let key in window.mtd.config.draftReasons) {
		if ( $("#M2D-option-reasons-checkbox-"+key).prop("checked") === true ) {
			reasons.push(key);
			reasonsShort.push(window.mtd.config.draftReasons[key].short);
		}
	}

	//Cloning the array
	var draftifyReasons = JSON.parse(JSON.stringify(window.mtd.config.draftReasons));

	//Other reasons text box
	var otherText = $("#M2D-reason-other").val();
	if ( otherText !== '' ) {
		draftifyReasons.other = { 'long': otherText };
		reasons.push('other');
		reasonsShort.push('নিজস্ব যৌক্তিকতা');
		$('#M2D-option-reasons-checkbox-other').prop("checked", true);
	} else {
		$('#M2D-option-reasons-checkbox-other').prop("checked", false);
	}

	var reasonText = "";
	if (reasons.length === 0) {
		$('#M2D-next').prop('disabled', true);
	} else {
		$('#M2D-next').prop('disabled', false);
		reasonText = " কারণ '''" + draftifyReasons[reasons[0]].long + "'''";
		if (reasons.length > 1) {
			for (let i = 1; i < (reasons.length - 1); i++) {
				reasonText += ", '''" + draftifyReasons[reasons[i]].long + "'''";
			}
			reasonText += " এবং '''" + draftifyReasons[reasons[reasons.length-1]].long + "'''";
		}
	}

	if (reasonsShort.length === 0) {
		reasonsShort.push("unspecified");
	}

	window.mtd.config.draftReasonsShort = "কারণ: " + reasonsShort.join(', ');
	window.mtd.config.notificationMessage = window.mtd.config.wikitext.notificationTemplate
			.replace(/\$1/g, getPageText($('#M2D-option-newtitle').val()))
			.replace(/\$3/g, reasonText);

	//Converting the message text into a preview
	window.API.get( {
		action: 'parse',
		text: "==" + $('#M2D-option-message-head').val() + "==\n" + window.mtd.config.notificationMessage,
		disableeditsection: true,
		contentmodel: 'wikitext'
	} )
	.then( function(result) {
		$('#M2D-option-message-preview').html( result.parse.text['*'] );
	} );
};

// Progress tasks
var getProgressTasks = function( tasks ) {
	var output = $('<ul>').attr('id', 'M2D-tasks').css("color", "#888");
	//Resetting to empty array
	window.mtd.config.processTimer = [];
	for ( const [ index, taskText ] of Object.entries( tasks ) ) {
		output.append(
			$('<li>').attr('id', 'M2D-task' + index ).append(
				taskText,
				$('<span>').attr('id','M2D-status' + index )
					.css( "margin", "0.75em" )
			)
		);
	}
	return output;
};

//3) Progress indicators
var showProgressScreen = function() {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	setupHeader(": চলছে...");

	$("#M2D-interface-content").append(
		getProgressTasks(
			[	'পাতা স্থানান্তর হচ্ছে',
				'অ-মুক্ত চিত্রের জন্য অনুসন্ধান করা হচ্ছে',
				'পাতার উইকিপাঠ্য সম্পাদনা করা হচ্ছে',
				'অবদানকারীদের বিজ্ঞপ্তি দেওয়া হচ্ছে',
				'আলাপ পাতার ব্যানার হালনাগাদ করা হচ্ছে',
				'খসড়াভুক্তি লগ রাখা হচ্ছে',
				'অপসারণের জন্য পুনঃনির্দেশ চিহ্নিত করা হচ্ছে'
			] )
	);

	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-abort').text('Abort uncompleted tasks'),
		$('<span>').attr('id', 'M2D-finished').hide().append(
			'সম্পন্ন!',
			$('<button>').attr('id', 'M2D-close').text('Close')
				.css('margin-left', '0.5em')
		)
	);

	$("#M2D-close").click( function(){
		$("#M2D-modal").remove();
		window.location.reload();
	} );
	$("M2D-abort").click( function(){
		window.API.abort();
		$("#M2D-modal").remove();
		window.location.reload();
	} );
};

// --- Add link to 'More' menu (or user-specified portlet) which starts everything ---
mw.util.addPortletLink( ( window.m2d_portlet||'p-cactions' ), '#', 'খসড়ায় স্থানান্তর', 'ca-m2d', null, null, "#ca-move");
$( '#ca-m2d' ).on( 'click', function( e ) {
	e.preventDefault();
	// Add interface shell
	$('body').prepend('<div id="M2D-modal">'+
		'<div id="M2D-interface">'+
			'<div id="M2D-interface-header"></div>'+
			'<hr>'+
			'<div id="M2D-interface-content"></div>'+
			'<hr>'+
			'<div id="M2D-interface-footer"></div>'+
		'</div>'+
	'</div>');

	// Interface styling
	$("#M2D-modal").css({
		"position": "fixed",
		"z-index": "1001",
		"left": "0",
		"top": "0",
		"width": "100%",
		"height": "100%",
		"overflow": "auto",
		"background-color": "rgba(0,0,0,0.4)"
	});
	$("#M2D-interface").css({
		"background-color": "#f0f0f0",
		"margin": "7% auto",
		"padding": "2px 20px",
		"border": "1px solid #888",
		"width": "80%",
		"max-width": "60em",
		"font-size": "90%"
	});
	$("#M2D-interface-content").css("min-height", "7em");
	$("#M2D-interface-footer").css("min-height", "2em");

	// Initial interface content
	screen0();
});
// </nowiki>
