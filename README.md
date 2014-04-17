jsaccess.log
============

Apache access.log parser in javascript. Lets you analyze access logs in nice SQL way

Features
--------

- parses Apache access.log using regexp
- saves it to WebSQL database
- provides an input for SQL query
- provides ability to bookmark queries (few interesting ones are provided initially)
- hides less useful columns for SELECT * queries
- draws histograms on columns reported by SQLite as numeric
- parses user-agent and referrer to browser, os, and search request
(if user came from one of supported search engines)
- uses Range requests to check for updates in files
- shows geoIP information for IP addresses

Requirements
------------

* Requires a [browser supporting WebSQL](http://caniuse.com/sql-storage)
(Chrome or Opera will do. Firefox and IE won't)

Installation
------------

> **TODO:** make it simpler

* confugure logrotate to keep first backup uncompressed (default on Ubuntu)
* symlink current and previous log files to a place available from your web browser
* If you're going to use geojs feature then use geojs.sh to generate geojs.txt
with cache of geoip information from your previous.log file
* download html5sql.js from http://html5sql.com/
* make HTML file like this:
````
<div id="here"></div>
<script src="html5sql.js"></script>
<script src="logviewer.js"></script>
<script src="geoip.js"></script>
<script>
filename_current='current.log';
filename_archive='previous.log';
update_time=7*24*60*60*1000;//milliseconds
geoip_cache_filename='geoip.txt';
init(document.getElementById('here'));
</script>
````
where:
* `filename_current` is filename of "current" log file
(expected to be increasing over time)
* `filename_archive` is filename of its archived version
(expected to be a copy of filename_current file
* `update_time` is time (in milliseconds) how often
`filename_current` gets moved to `filename_archive`
(7 days by default)

Usage
-----

* open the page with your web browser
* it will load the log file into `log` table
and (optionally) geoip data into `geoip` table
* `big` is an alias (VIEW) for `log NATURAL LEFT JOIN geoip`
* you can select a bookmarked query or type your own

Plans
-----

* check for required features in the browser and show message if they're not supported
* hide too long strings (imagine ua) behind overflow:hidden and show them on click
* tell SQLite which columns are numeric ones
* change bookmarks to use `big` if it exists
* show reverse IP hostname: api.hackertarget.com/reversedns/?q=109.120.165.193
* support more geoIP providers:
ipgeobase.ru:7020/geo?ip=109.120.165.193
api.ipinfodb.com/v3/ip-city/?key=<your_api_key>&ip=109.120.165.193
