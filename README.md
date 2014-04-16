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

Requirements
------------

* Requires a [browser supporting WebSQL](http://caniuse.com/sql-storage)
(Chrome or Opera will do. Firefox and IE won't)

Installation
------------

* symlink or copy log file you want to be analyzed to a place available from your web browser
* Point `filename_current` variable to that file
* Point `filename_archive` variable to its backup
* Set `update_time` variable to time (in milliseconds) how often do you move
`filename_current` to `filename_archive`

Usage
-----

* open the page with your web browser
* it will load the file into `log` table
* to reload data, execute `DROP TABLE log` query and reload the page

Plans
-----

* check for required features in the browser and show message if they're not supported
* hide too long strings (imagine ua) behind overflow:hidden and show them on click
* tell SQLite which columns are numeric ones
* show geoIP information and, maybe, reverse DNS names for IP addresses

