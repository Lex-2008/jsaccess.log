databaseName='access_log_db';
displayName='Access logs';
estimatedSize=1*1000*1000;

filename='access.log';

// 127.0.0.1 localhost - [06/Apr/2014:13:53:23 +0200] "GET /index.html HTTP/1.1" 200 2780 "http://localhost/" "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:28.0) Gecko/20100101 Firefox/28.0"
var re=/^([^ ]*) ([^ ]*) ([^ ]*) \[([^\]]*)\] "(GET|POST|HEAD|CONNECT) (.*) (HTTP\/1\..)" ([0-9]*) ([0-9]*) "([^ ]*)" "(.*)"$/;
var fields='ip, hostname, user, datetime, method, url, protocol, response, size, referrer, ua';

function gebi(id){return document.getElementById(id)};
function escapeHTML(text){return (''+text).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
function log(text){gebi('result').innerHTML='<pre>'+escapeHTML(text)+'</pre>'}
function error_handler(error, statement){log("Error [" + error.message + "] when processing [" + statement+']');}

function init(cb){
	html5sql.openDatabase(databaseName, displayName, estimatedSize);
	// var create_table_sql = 'CREATE TABLE log '+'('+fields+')';
	// TODO: check if tables sql match given, if not -- drop
	// use 'select * from sqlite_master'
	requests=['CREATE TABLE IF NOT EXISTS log '+'('+fields+')'];
	var afields=fields.split(/[, ]+/);
	// TODO: add user-defined indexes
	for(var i in afields) {
		requests.push('CREATE INDEX IF NOT EXISTS '+afields[i]+
				' ON log'+'('+afields[i]+')')
	}
	requests.push('ANALYZE log');
	requests.push('SELECT stat FROM sqlite_stat1 WHERE tbl="log" LIMIT 1');
	html5sql.process(requests,
			function(tx, result) {
				if(result.rows.length==0 || result.rows.item(0).stat.charAt(0)=='0') {
					read_file_into_table(cb);
				}
				else {
					cb();
				}
			},
			error_handler);
};

function read_file_into_table(cb){
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open('GET',filename, true);
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4) {
			if(xmlhttp.status == 200) {
				read_text_into_table(xmlhttp.responseText,cb);
			}
		}
	};
	log('Loading '+filename);
	xmlhttp.send(null);
}

function read_text_into_table(text,cb){
	var trim = function (string) {
		return string.replace(/^\s+/, "").replace(/\s+$/, "");
	};
	lines=text.split('\n').map(trim);
	requests=[];
	log('Parsing '+lines.length+' entries...');
	for(var line in lines){
		if(lines[line]=='') {
			continue;
		};
		var match=lines[line].match(re);
		if(!match) {
			console.error("Can't match string: ["+lines[line]+']');
			continue;
		};
		match.shift();
		// TODO: add user-defined processing
		requests.push({
			sql:'INSERT INTO log '+'('+fields+')'+
			'VALUES'+'('+fields.replace(/[^ ,]+/g, '?')+ ')',
			data:match});
	};
	log('Sending to database...');
	html5sql.process(requests,
			function(){ cb() },
			error_handler);
}



function process_SQL(sql){
	html5sql.process(sql,show_SQL_results,error_handler);
}

function show_SQL_results(tx, response){
	if(response.rows.length==0) {
		log('empty response!');
		return;
	}
	var result='<table><thead><tr>';
	// column headers
	var columns=[];
	for(var name in response.rows.item(0)) {
		columns.push(name);
		result+='<th>'+escapeHTML(name)+'</th>';
	}
	result+='</tr></thead><tbody>';
	// all rows
	for(var i=0; i<response.rows.length; i++){
		var row=response.rows.item(i);
		result+='<tr>';
		for(var j=0; j<columns.length; j++){
			if(columns[j] in row){
				result+='<td>'+escapeHTML(row[columns[j]])+'</td>';
			} else {
				result+='<td> </td>';
			}
		}
		result+='</tr>';
	}
	result+='</tbody></table>';
	gebi('result').innerHTML=result;
}
