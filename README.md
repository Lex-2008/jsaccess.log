jsaccess.log
============

Apache access.log parser in javascript

Features
--------

- parses Apache access.log using regexp
- saves it to WebSQL database
- provides an input for SQL query
- bookmark some interesting queries (few are provided at start)
- can hide some columns (useful for SELECT * queries)

Requirements
------------

* Requires a [browser supporting WebSQL](http://caniuse.com/sql-storage)
(Chrome or Opera will do. Firefox and IE won't)

Installation
------------

* symlink or copy log file you want to be analyzed to a place available from your web browser
* Point 'filename' variable to that file

Usage
-----

* open the page with your web browser
* it will load the file into `log` table
* to reload data, execute `DROP TABLE log` query and reload the page

Plans
-----

* parse ua into browser, os, etc
* parse referrer to search string for some search engines
* hide too long strings (imagine ua) behind overflow:hidden and show them on click
* make configuration easier (call one function with parameters and generate HTML on the fly)
* use Range requests to check for updates in files
* tell SQLite which columns are numeric ones
* draw histograms on numeric columns

