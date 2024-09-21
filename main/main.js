/******************************************************************************
 MoveToDraft
-------------
Version 2.5.8
-------------
A script to move unsourced articles to draft space, including cleanup and author notification.
- Moves page to draftspace
- Checks if any files used are non-free
- Checks if any redirects pointed to the page
- Comments out non-free files, turn categories into links, add afc draft template, add redirects
- Adds notification message on author talk page
- Updates talk page banners
- Logs draftification in user subpage

 derived from https://en.wikipedia.org/wiki/User:Evad37/MoveToDraft.js
******************************************************************************/
/* jshint laxbreak: true, undef: true, maxerr:999 */
/* globals console, window, document, $, mw */

// Script info
var mtd = {
    config: {
        script: {
            // For window header
            location: "User:Tanbiruzzaman/MoveToDraft",
            version: "2.5.8"
        }
    }
},
API;

$.when(
    // Resource loader modules
    mw.loader.using([ 'mediawiki.util', 'mediawiki.api', 'mediawiki.Title' ]),
    // Page ready
    $.ready
).then(function() {
/* ========== Config ======================================================= */
    // MediaWiki configuration values
    mtd.config.mw = mw.config.get([
        "wgArticleId",
        "wgCurRevisionId",
        "wgPageName",
        "wgUserGroups",
        "wgUserName",
        "wgMonthNames",
        "wgNamespaceNumber",
        "wgTitle",
        "wgArticlePath",
        "wgIsMainPage",
        "wgIsRedirect"
    ]);

/* ========== API ========================================================== */
    API = new mw.Api({
        ajax: {
            headers: { 
                "Api-User-Agent": "MoveToDraft/" + mtd.config.script.version + 
                    " ( https://bn.wikipedia.org/wiki/User:Tanbiruzzaman/MoveToDraft )"
            }
        }
    });

    var dynamicallyLoadScript = function(url) {
        let loadScript = document.createElement('script');
        loadScript.src = url + '?action=raw&ctype=text/javascript';
        document.head.appendChild(loadScript);
    };

/* ========== Setup ============================================================================= */
    // Access draftifications using Special:খসড়া_লগ/ব্যবহারকারী_নাম
    var isDraftifyLogPage = mtd.config.mw.wgPageName.indexOf("Special:খসড়া_লগ") === 0;
    var isUserPage = mtd.config.mw.wgNamespaceNumber === 2 || mtd.config.mw.wgNamespaceNumber === 3;
    if (isDraftifyLogPage) {
        dynamicallyLoadScript(
            mtd.config.mw.wgArticlePath.replace('$1', 'User:Tanbiruzzaman/MoveToDraft/draftifyLog.js')
        );
        return;
    } else if (isUserPage) {
        var user = mtd.config.mw.wgTitle.split('/')[0];
        var url = mw.util.getUrl("Special:খসড়া_লগ/" + user);
        mw.util.addPortletLink((window.m2d_portlet || 'p-cactions'), url, 'খসড়া লগ', 'ca-m2dlog', null, null, "#ca-move");
        return;
    }

    // Only operate in article namespace
    if(mtd.config.mw.wgNamespaceNumber !== 0) {
        return;
    }

    // Don't draftify MainPage
    if(mtd.config.mw.wgIsMainPage === true) {
        return;
    }

    // Only operate for existing pages
    if (mtd.config.mw.wgCurRevisionId === 0) {
        return;
    }

    // Only for articles
    if (mtd.config.mw.wgIsRedirect === true) {
        return;
    }

    dynamicallyLoadScript(
        mtd.config.mw.wgArticlePath.replace('$1', 'User:Tanbiruzzaman/MoveToDraft/core.js')
    );

});
