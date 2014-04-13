databaseName='access_log_db';
displayName='Access logs';
estimatedSize=1*1000*1000;

filename='access.log';

// 127.0.0.1 localhost - [06/Apr/2014:13:53:23 +0200] "GET /index.html HTTP/1.1" 200 2780 "http://localhost/" "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:28.0) Gecko/20100101 Firefox/28.0"
re=/^([^ ]*) ([^ ]*) ([^ ]*) \[([^\]]*)\] "(GET|POST|HEAD|CONNECT) (.*) (HTTP\/1\..)" ([0-9]*) ([0-9]*) "([^ ]*)" "(.*)"$/;
fields='ip, hostname, user, datetime, method, url, protocol, response, size, ref, ua';
// above fields are matched from regexp; below fields are added by script
fields+=', date, time, bot, browser, browser_ver, os, os_ver, ref_host, search';

afields=fields.split(/[, ]+/);
hidden={'user':1, 'datetime':1, 'method':1, 'protocol':1, 'ref':1, 'ua':1};
use_hidden=true;
bookmarks={
	"SELECT * FROM log ORDER BY date DESC, time DESC LIMIT 10":"Last 10 visits",
	"SELECT * FROM log WHERE url=\"/\" ORDER BY date DESC, time DESC LIMIT 10":"Last 10 visits for a specific URL",
	"SELECT url, count(*) FROM log GROUP BY url ORDER BY count(*) DESC LIMIT 50":"Top 50 pages",
	"SELECT response, count(*) FROM log GROUP BY response ORDER BY count(*) DESC":"Response codes",
	"SELECT url, count(*) FROM log WHERE response=\"404\" GROUP BY url ORDER BY count(*) DESC LIMIT 20":"Top 20 \"404 Not Found\" responses",
	"SELECT url, size/1000/1000. AS \"size(MB)\", count(*) FROM log GROUP BY url ORDER BY CAST(size AS NUMERIC) DESC LIMIT 50":"Top 50 heaviest resources",
	"SELECT browser, bot, count(*) FROM log GROUP BY browser ORDER BY count(*) DESC LIMIT 20":"Top 20 browsers (incl bots)",
	"SELECT os, os_ver, count(*) FROM log WHERE bot=\"no\" GROUP BY os, os_ver ORDER BY count(*) DESC":"Popular OSes",
	"SELECT ref_host, count(*) FROM log WHERE ref_host<>\"\" GROUP BY ref_host ORDER BY count(*) DESC LIMIT 10":"Top 10 traffic sources",
	"SELECT ref_host as search_engine, search, count(*) FROM log WHERE search<>\"\" GROUP BY ref_host, search ORDER BY count(*) DESC LIMIT 10":"Top 10 search requests",
	"SELECT ua, count(*) FROM log WHERE browser=\"unknown\" GROUP BY ua ORDER BY count(*) DESC LIMIT 50":"Top unknown browsers",
};

function gebi(id){return document.getElementById(id)};
function escapeHTML(text){return (''+text).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
function log(text){gebi('result').innerHTML='<pre>'+escapeHTML(text)+'</pre>'}
function error_handler(error, statement){log("Error [" + error.message + "] when processing [" + statement+']');}


function init(elem){
	var str='';
	str+='<style>';
	str+='#query, #bookmarks {width: 90% }';
	str+='#submit, #bookmark {width: 9% }';
	str+='#hidden_list li {display: inline; border: 1px solid black; padding: 1px 1em; margin: 1px 1em; cursor: pointer; font-weight: bold}';
	str+='#result table { border-collapse:collapse; table-layout: fixed; word-wrap: break-word; width: 100%}';
	str+='#result table th {cursor: pointer; }';
	str+='#result table, #result td, #result th { border:1px solid black; }';
	str+='#result pre {white-space: pre-wrap}';
	str+='</style>';
	str+='<select id="bookmarks"></select><input type="button" id="bookmark" value="<<<">';
	str+='<input id="query"><input type="submit" id="submit">';
	str+='<ul id="hidden_list"></ul>';
	str+='<style id="hidden_style"></style>';
	str+='<div id="result"></div>';
	elem.innerHTML=str;
	init_db(function(){log('ready!')});
	init_bookmarks();
	init_hidden();
	gebi('submit').onclick=function(){process_SQL(gebi('query').value)};
	gebi('bookmark').onclick=function(){bookmark(gebi('query').value)};
	gebi('bookmarks').onchange=function(){if(this.value){gebi('query').value=this.value;this.value=''}};
}


function init_db(cb){
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
		// parse ua to bot, browser, browser_ver, os, os_ver
		var ua=parse_ua(match[field_pos['ua']]);
		match=match.concat([ua.bot,ua.browser,ua.browser_ver,ua.os,ua.os_ver]);
		// parse ref to ref_host, search
		var ref=parse_ref(match[field_pos['ref']])
		match=match.concat([ref.host,ref.search]);
		requests.push({
			sql:'INSERT INTO log '+'('+fields+')'+
			'VALUES'+'('+fields.replace(/[^ ,]+/g, '?')+ ')',
			data:match});
	};
	log('Sending to database...');
	html5sql.process(requests,
			function(){cb()});
}



function parse_ua(ua) {
	var browsers={
		'MSIE':{ver: [/MSIE.([\d.]*)/]},
		'OPR':{ver: [/OPR.([\d.]*)/]},//Note: OPR should go above Chrome
		'Chrome':{ver: [/Chrome.([\d.]*)/]},
		'Firefox':{ver: [/Firefox.([\d.]*)/]},
		'Opera':{ver: [/Version.([\d.]*)/, /Opera.([\d.]*)/]},
		'Runet-Research-Crawler':{bot:true, ver: []},
		'YandexImages':{bot:true, ver: [/YandexImages.([\d.]*)/]},
		'Nutch':{bot:true, ver: [/Nutch.([\d.]*)/]},
		'YandexDirect':{bot:true, ver: [/YandexDirect.([\d.]*)/]},
		'Safari':{ver: [/Safari.([\d.]*)/]},
		'Trident':{ver: [/Trident.([\d.]*)/]},
		/*
		// these bots made less than 10 hits each during last week
		'curl':{bot:true, ver: [/curl.([\d.]*)/]},
		'vkShare':{bot:true, ver: []},
		'Baiduspider':{bot:true, ver: [/Baiduspider.([\d.]*)/]},
		'Ezooms':{bot:true, ver: [/Ezooms.([\d.]*)/]},
		'archive.org_bot':{bot:true, ver: []},
		'Google-Site-Verification':{bot:true, ver: [/Google-Site-Verification.([\d.]*)/]},
		'Who.is Bot':{bot:true, ver: []},
		'NetcraftSurveyAgent':{bot:true, ver: [/NetcraftSurveyAgent.([\d.]*)/]},
		'BingPreview':{bot:true, ver: [/BingPreview.([\d.]*)/]},
		'statdom.ru/Bot':{bot:true, ver: []},
		'facebookexternalhit':{bot:true, ver: [/facebookexternalhit.([\d.]*)/]},
		*/
	};
	var os={
		'Windows':{ver: [/Windows NT.([\d.]*)/]},
		'Android':{ver: [/Android.([\d.]*)/]},//Note: Android should go above Linux
		'Linux':{ver: [/(Ubuntu)/]},
		'iPhone OS':{ver: [/iPhone OS.([\d._]*)/]},//Note_ iPhone should go above Mac OS
		'Mac OS':{ver: [/Mac OS X.([\d._]*)/]},
	};
	var result={
		'bot':'maybe',
		'browser':'unknown',
		'browser_ver':'unknown',
		'os':'unknown',
		'os_ver':'unknown',
	};
	for(var i in browsers){
		if(ua.indexOf(i)>-1){
			result.browser=i;
			result.bot=browsers[i].bot?'yes':'no';
			for(var j in browsers[i].ver){
				var match=ua.match(browsers[i].ver[j]);
				if(match) {
					result.browser_ver=match[1];
					break;
				}
			}
			break;
		}
	}
	for(var i in os){
		if(ua.indexOf(i)>-1){
			result.os=i;
			for(var j in os[i].ver){
				var match=ua.match(os[i].ver[j]);
				if(match) {
					result.os_ver=match[1];
					break;
				}
			}
			break;
		}
	}
	if(result.browser=='unknown'){
		var match=ua.match(/([\w\d_.-]*bot[\w\d_.-]*)\/([\w\d.\/]*)/i);
		if(match){
			result.bot='bot';
			result.browser=match[1];
			result.browser_ver=match[2];
		}
	}
	return result;
}

function parse_ref(ref){
	var result={
		'host':'',
		'search':'',
	}
	if(ref=='-'){
		return result;
	}
	// host
	var global=['google','yandex'];
	var match=ref.match(/https?:\/\/([^\/]*)/);
	if(match) {
		result.host=match[1];
		for(var i in global) {
			if(result.host.indexOf(global[i])>-1) {
				result.host=global[i];
				break;
			}
		}
	}
	// search
	var searches={
		'yandex.ru/search':{
			match:/text=([^&]*)/,
			decode:function(text){
				var cp1251="ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя";
				var cp866="АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■"+String.fromCharCode(160);
				try{
					return change_charset(decodeURIComponent(text), cp866, cp1251).replace(/\+/g,' ');
				} catch(e){
					return unescape_with_charset(text, cp1251);
				}
			}
		},
		'go.mail.ru':{match:/q=([^&]*)/},
		'nigma.ru':{match:/s=([^&]*)/},
		'bing.com':{match:/q=([^&]*)/},
		'yandex.ru/clck':{match:/text=([^&]*)/},
		'yandex.ru/touchsearch':{match:/text=([^&]*)/},
		'yandex.ru/yandsearch':{same_as:'yandex.ru/search'},
		'yandex.ua/search':{same_as:'yandex.ru/search'},
		'yandex.ua/clck':{same_as:'yandex.ru/clck'},
		'yandex.ua/touchsearch':{same_as:'yandex.ru/touchsearch'},
	}
	for(var i in searches){
		if(ref.indexOf(i)>-1){
			if(searches[i].same_as) {
				i=searches[i].same_as;
			};
			var match=ref.match(searches[i].match);
			if(match) {
				if(searches[i].decode) {
					result.search=searches[i].decode(match[1]);
				} else {
					result.search=decodeURIComponent(match[1]).replace(/\+/g,' ');
				}
			}
			break;
		}
	}
	return result;
}

function change_charset(text, from, to){
	var ret='';
	for(i=0;i<text.length;i++){
		var pos=from.indexOf(text[i]);
		if(pos>-1){
			ret+=to[pos];
		} else {
			ret+=text[i];
		}
	}
	return ret;
}

function unescape_with_charset(text, chars){
	var ret='';
	for(i=0;i<text.length;i++){
		if(text[i]=='%'){
			var charCode=parseInt(text[i+1]+text[i+2],16);
			if(charCode<128) {
				ret+=String.fromCharCode(charCode);
			} else {
				ret+=chars[charCode-128];
			};
			i+=2;
		}else if(text[i]=='+'){
			ret+=' ';
		}else{
			ret+=text[i];
		}
	}
	return ret;
}

function process_SQL(sql){
	use_hidden=sql.match(/^\s*SELECT\s*\*/i);
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
	if(use_hidden) {
		var hidden_list='';
		var hidden_style=[];
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
		for(var className in hidden) {
			if(hidden[className]) {
				hidden_style.push('#result table .'+className);
			}
		}
		gebi('hidden_style').innerHTML=hidden_style.join(',')+'{display:none}';
	} else {
		gebi('hidden_list').innerHTML='';
		gebi('hidden_style').innerHTML='';
	}
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
