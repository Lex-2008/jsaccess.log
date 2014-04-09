jsaccess.log
============

Apache access.log parser in javascript

Features
--------

- parses Apache access.log using regexp
- saves it to WebSQL database
- provides an input for SQL query

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

Useful queries
--------------

* `SELECT * FROM log LIMIT 10` to see first 10 requests
* `SELECT *, count(1) FROM log WHERE response="404" GROUP BY url ORDER BY count(1) DESC`
to see URLs which returned "404 Not Found" error
* `SELECT *, count(1) FROM log WHERE response="301" GROUP BY url ORDER BY count(1) DESC`
to get similar statistics about redirects

Plans
-----

* parse ua into browser, os, etc
* parse referrer to search string for some search engines
* bookmark useful queries

