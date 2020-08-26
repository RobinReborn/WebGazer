#!/bin/sh
if  ! [ -f www/data/src/P_01/dot.y4m ] ; then
	echo "Creating .y4m file for video input"
	ffmpeg -hide_banner -loglevel panic -i www/data/src/P_01/1491423217564_2_-study-dot_test_instructions.webm -pix_fmt yuv420p dot.y4m > /dev/null
	sed -i '0,/C420mpeg2/s//C420/' dot.y4m
	mv dot.y4m www/data/src/P_01/
fi
if ! netstat -ltnp | grep :8000 ; then
	cd www/data/src
	python3 webgazerExtractServer.py > /dev/null &
	cd ../../..
fi
if ! netstat -ltnp | grep :3000 ; then
	cd www/
	browser-sync start --server --no-open > /dev/null &
	cd ..
fi
echo "starting tests..."
npx mocha test --recursive --no-timeouts
echo "finishing tests, killing servers..."

kill $(lsof -t -i:3000)
kill $(lsof -t -i:8000) 