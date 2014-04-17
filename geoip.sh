#!/bin/bash
cut -d ' ' -f 1 previous.log | sort -u | sed 's/.*/--url freegeoip.net\/csv\/&/' | curl -K - >geoip.txt
