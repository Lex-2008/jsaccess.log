#!/bin/bash
cut -d ' ' -f 1 $(dirname $0)/previous.log | sort -u | wget -nv -i - -B http://www.telize.com/geoip/ -O $(dirname $0)/geoip.txt
