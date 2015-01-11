(function(){
	window.geoip_cache_filename='geoip.txt';
	var fields='longitude, latitude, asn, offset, ip, area_code, continent_code, dma_code, city, timezone, region, country_code, isp, postal_code, country, country_code3, region_code';
	var afields=fields.split(/[, ]+/);
	var missing_ips=[];
	var missing_ips_total=0;
	var missing_ips_stop=false;
	var log_show=true;
	function log(text,force){console.log(text);if(log_show||force){gebi('result').innerHTML='<pre>'+escapeHTML(text)+'</pre>'}};
	function log_button(text,onclick){
		var button=document.querySelector('#result pre').appendChild(
			document.createElement('button'));
		button.onclick=onclick;
		button.innerHTML=escapeHTML(text);
	}

	window.geoip_init = function(){
		var create_table_sql = 'CREATE TABLE geoip '+'('+fields+')';
		var cb=function(){geoip_check_missing()};
		html5sql.process('SELECT sql FROM sqlite_master WHERE type="table" AND name="geoip"',
			function(tx, result) {
				if(result.rows.length==0) {
					init_table(cb,[create_table_sql]);
				} else if(result.rows.item(0).sql!=create_table_sql) {
					init_table(cb,['DROP TABLE geoip', create_table_sql]);
				} else {
					read_file_into_table(cb);
				}
			});
		if(!localStorage[databaseName+'_hidden']) {
			hidden.country=1;
			hidden.region=1;
			hidden.zip_code=1;
			hidden.metro_code=1;
			hidden.area_code=1;
		};
	};

	function init_table(cb,requests){
		for(var i in afields) {
			requests.push('CREATE INDEX IF NOT EXISTS geoip_'+afields[i]+
				' ON geoip'+'('+afields[i]+')');
		}
		requests.push('CREATE UNIQUE INDEX IF NOT EXISTS geoip_ip_unique ON geoip (ip)');
		requests.push('CREATE VIEW IF NOT EXISTS big AS SELECT * FROM log NATURAL LEFT JOIN geoip');
		html5sql.process(requests, function(tx, result) {read_file_into_table(cb)});
	};

	function read_file_into_table(cb, filename){
		if(!filename) {
			filename=window.geoip_cache_filename;
		}
		var last_load=false;
		if(filename==window.geoip_cache_filename){
			if(localStorage[databaseName+'_geoip_last_load']) {
				try{
					last_load=JSON.parse(localStorage[databaseName+'_geoip_last_load']);
				} catch(e) {
					delete localStorage[databaseName+'_geoip_last_load'];
				};
			}
		}
		xmlhttp = new XMLHttpRequest();
		xmlhttp.open('GET',filename, true);
		if(last_load) {
			if(last_load.time) xmlhttp.setRequestHeader("If-Modified-Since", last_load.time);
			if(last_load.tag) xmlhttp.setRequestHeader("If-None-Match", last_load.tag);
		}
		xmlhttp.onreadystatechange = function() {
			if (xmlhttp.readyState == xmlhttp.DONE) {
				if(filename==window.geoip_cache_filename){
					var last_load={
						time:xmlhttp.getResponseHeader('Last-Modified'),
						tag:xmlhttp.getResponseHeader('ETag'),
					};
					localStorage[databaseName+'_geoip_last_load']=JSON.stringify(last_load);
				}
				read_text_into_table(xmlhttp.responseText,cb);
			}
		}
		log('Loading '+filename+' for geoip information...');
		xmlhttp.send(null);
	};

	function read_text_into_table(text,cb){
		var trim = function (string) {
			return string.replace(/^\s+/, "").replace(/\s+$/, "");
		};
		var quotetrim = function (string) {
			return string.replace(/^[\s"]+/, "").replace(/[\s",]+$/, "");
		};
		var lines=text.split('\n').map(trim);
		var requests=[];
		log('Parsing '+lines.length+' geoip entries...');
		for(var line in lines){
			if(lines[line]=='') {
				continue;
			};
			var json;
			try {
				json=JSON.parse(lines[line]);
			} catch(e) {
				continue;
				log('Could not parse JSON: ['+lines[line]+']');
			}
			var data=[];
			for(var i in afields) {
				data[i]=json[afields[i]];
			}
			requests.push({
				sql:'INSERT OR REPLACE INTO geoip '+
				'VALUES'+'('+fields.replace(/[^ ,]+/g, '?')+ ')',
				data:data});
		};
		if(requests.length>0) {
			log('Sending '+requests.length+' rows to geoip table...');
			html5sql.process(requests, function(){if(cb)cb()});
		} else {
			if(cb)cb()
		}
	};

	window.geoip_check_missing=function(){
		html5sql.process('SELECT DISTINCT ip FROM log NATURAL LEFT JOIN geoip WHERE geoip.ip IS null',
				function(tx, results){
					missing_ips=[];
					for(var i = 0; i < results.rows.length; i++){
						missing_ips.push(results.rows.item(i).ip);
					}
					if(missing_ips.length>0) {
						//gebi('result').innerHTML=missing_ips.length+
						log(missing_ips.length+' IPs missing geoIP information. ');
						log_button('Get them!', geoip_fill_missing);
					} else {
						log('ready');
					}
				});
	};

	window.geoip_fill_missing=function(){
		log_show=false;
		missing_ips_total=missing_ips.length;
		missing_ips_stop=false;
		var getNext=function(){
			if(missing_ips_stop){
				log_show=true;
				log('stopped!');
				return;
			}
			var ip=missing_ips.shift();
			if(ip){
				log('['+(missing_ips_total-missing_ips.length)+'/'+missing_ips_total+'] = '+
						Math.round((missing_ips_total-missing_ips.length-1)*100/missing_ips_total)+'%: '+
						'looking for '+ip,true);
				log_button('Stop it!',function(){missing_ips_stop=true});
				geoip_lookupIP(ip,getNext);
			} else {
				log_show=true;
				log('done!');
			}
		}
		getNext();
	};

	window.geoip_lookupIP=function(ip,cb){
		read_file_into_table(cb,
				'//www.telize.com/geoip/'+ip);
	};


})()
