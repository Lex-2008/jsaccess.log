#!/bin/bash
cut -d ' ' -f 1 $(dirname $0)/previous.log | sort -u | wget -i - -B http://freegeoip.net/csv/ -O $(dirname $0)/geoip.txt
