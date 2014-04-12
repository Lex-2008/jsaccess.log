databaseName='access_log_db';
displayName='Access logs';
estimatedSize=1*1000*1000;

filename='access.log';

// 127.0.0.1 localhost - [06/Apr/2014:13:53:23 +0200] "GET /index.html HTTP/1.1" 200 2780 "http://localhost/" "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:28.0) Gecko/20100101 Firefox/28.0"
re=/^([^ ]*) ([^ ]*) ([^ ]*) \[([^\]]*)\] "(GET|POST|HEAD|CONNECT) (.*) (HTTP\/1\..)" ([0-9]*) ([0-9]*) "([^ ]*)" "(.*)"$/;
fields='ip, hostname, user, datetime, method, url, protocol, response, size, referrer, ua';
// above fields are matched from regexp; below fields are added by script
fields+=', date, time';

afields=fields.split(/[, ]+/);
hidden={'user':1, 'datetime':1, 'method':1, 'protocol':1};
bookmarks={
	"SELECT * FROM log ORDER BY date DESC, time DESC LIMIT 10":"Last 10 visits",
	"SELECT * FROM log WHERE url=\"/\" ORDER BY date DESC, time DESC LIMIT 10":"Last 10 visits for a specific URL",
	"SELECT url, count(*) FROM log GROUP BY url ORDER BY count(*) DESC LIMIT 50":"Top 50 pages",
	"SELECT response, count(*) FROM log GROUP BY response ORDER BY count(*) DESC":"Response codes",
	"SELECT url, count(*) FROM log WHERE response=\"404\" GROUP BY url ORDER BY count(*) DESC LIMIT 20":"Top 20 \"404 Not Found\" responses",
	"SELECT url, size/1000/1000. AS \"size(MB)\", count(*) FROM log GROUP BY url ORDER BY CAST(size AS NUMERIC) DESC LIMIT 50":"Top 50 heaviest resources",
};

function gebi(id){return document.getElementById(id)};
function escapeHTML(text){return (''+text).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
function log(text){gebi('result').innerHTML='<pre>'+escapeHTML(text)+'</pre>'}
function error_handler(error, statement){log("Error [" + error.message + "] when processing [" + statement+']');}

function init(cb){
	html5sql.openDatabase(databaseName, displayName, estimatedSize);
	html5sql.defaultFailureCallback=error_handler;
	var create_table_sql = 'CREATE TABLE log '+'('+fields+')';
	html5sql.process('SELECT sql FROM sqlite_master WHERE type="table" AND name="log"',
			function(tx, result) {
				if(result.rows.length==0) {
					init_table(cb,[create_table_sql]);
				} else if(result.rows.item(0).sql!=create_table_sql) {
					init_table(cb,['DROP TABLE log', create_table_sql]);
				} else {
					read_file_into_table_if_needed(cb);
				}
			});
};

function init_table(cb,requests){
	// TODO: add user-defined indexes
	for(var i in afields) {
		requests.push('CREATE INDEX IF NOT EXISTS '+afields[i]+
				' ON log'+'('+afields[i]+')');
	}
	html5sql.process(requests,
			function(){read_file_into_table(cb)});
};

function read_file_into_table_if_needed(cb){
	html5sql.process(['ANALYZE log', 'SELECT stat FROM sqlite_stat1 WHERE tbl="log" LIMIT 1'],
			function(tx, result) {
				if(result.rows.length==0 || result.rows.item(0).stat.charAt(0)=='0') {
					read_file_into_table(cb);
				}
				else {
					cb();
				}
			});
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
	var field_pos={};//{ip:0, hostname: 1,...}
	for(var i in afields) {
		field_pos[afields[i]]=i;
	}
	var months={'Jan':'01', 'Feb':'02', 'Mar':'03', 'Apr':'04', 'May':'05', 'Jun':'06', 'Jul':'07', 'Aug':'08', 'Sep':'09', 'Oct':'10', 'Nov':'11', 'Dec':'12'};
	var lines=text.split('\n').map(trim);
	var requests=[];
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
		// parse Apache date to SQLite date
		var datetime=match[field_pos['datetime']].match(/^(\d*)\/(\w*)\/(\d*):([\d:]*)/);
		match.push(datetime[3]+'-'+months[datetime[2]]+'-'+datetime[1]);//date
		match.push(datetime[4]);//time
		requests.push({
			sql:'INSERT INTO log '+'('+fields+')'+
			'VALUES'+'('+fields.replace(/[^ ,]+/g, '?')+ ')',
			data:match});
	};
	log('Sending to database...');
	html5sql.process(requests,
			function(){cb()});
}



function process_SQL(sql){
	html5sql.process([sql],show_SQL_results);
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
		result+='<th class="'+escapeHTML(name)+'">'+escapeHTML(name)+'</th>';
	}
	result+='</tr></thead><tbody>';
	// all rows
	for(var i=0; i<response.rows.length; i++){
		var row=response.rows.item(i);
		result+='<tr>';
		for(var j=0; j<columns.length; j++){
			if(columns[j] in row){
				result+='<td class="'+escapeHTML(columns[j])+'">'+escapeHTML(row[columns[j]])+'</td>';
			} else {
				result+='<td> </td>';
			}
		}
		result+='</tr>';
	}
	result+='</tbody></table>';
	gebi('result').innerHTML=result;
	// refresh list of hidden columns
	cv_me();
}

function cv_me(){
	if(this.className) {
		hidden[this.className]=!hidden[this.className];
	}
	var hidden_list='';
	var headers=document.querySelectorAll('#result table th');
	for(var i=0; i<headers.length; i++) {
		headers[i].onclick=cv_me;
		if(hidden[headers[i].className]) {
			hidden_list+='<li class="'+headers[i].className+'">'+headers[i].className+'</li>';
		}
	}
	gebi('hidden_list').innerHTML=hidden_list;
	var items=document.querySelectorAll('#hidden_list li');
	for(var i=0; i<items.length; i++) {
		items[i].onclick=cv_me;
	}
	var hidden_style=[];
	for(var className in hidden) {
		if(hidden[className]) {
			hidden_style.push('#result table .'+className);
		}
	}
	gebi('hidden_style').innerHTML=hidden_style.join(',')+'{display:none}';
}

function init_hidden(){
	if(localStorage.hidden) {
		try{
			hidden=JSON.parse(localStorage.hidden);
		} catch (e) {
			delete localStorage.hidden;
		}
	}
}

function bookmark(text){
	var title=prompt(
			bookmarks[text]?'Edit title (make empty to delete):':'Add bookmark (enter title):',
			bookmarks[text]?bookmarks[text]:'');
	if(title=='') {
		delete bookmarks[text];
	} else if(bookmarks[text]==title) {
		// nothing changed, nothing to do
		return;
	} else {
		bookmarks[text]=title;
	}
	localStorage.bookmarks=JSON.stringify(bookmarks);
	rebuild_bookmarks();
};

function rebuild_bookmarks(){
	var bookmarks_text='<option value="">Select a bookmarked query to paste or type your own</option>';
	for(var sql in bookmarks) {
		bookmarks_text+='<option value="'+escapeHTML(sql)+'">'+escapeHTML(bookmarks[sql])+'</option>';
	}
	gebi('bookmarks').innerHTML=bookmarks_text;
}

function init_bookmarks(){
	if(localStorage.bookmarks) {
		try{
			bookmarks=JSON.parse(localStorage.bookmarks);
		} catch (e) {
			delete localStorage.bookmarks;
		}
	}
	rebuild_bookmarks();
}
