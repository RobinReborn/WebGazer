#!/usr/bin/env python
import logging
import os
import subprocess
import sys
import glob
import re

import time
import datetime
import math

from binascii import a2b_base64

from itertools import chain

import tornado.web
import tornado.websocket
import tornado.httpserver
import tornado.ioloop
import tornado.log
import tornado.escape

import json, csv, urllib
import numpy as np

from videoProcessing import readImageRGBA,loadScreenCapVideo,writeScreenCapOutputFrames,openScreenCapOutVideo,\
    closeScreenCapOutVideo,sendVideoFrame,sendVideoEnd
import global_variables
from participant import ParticipantData,TobiiData,sendParticipantInfo,ParticipantVideo,newParticipant,showParticipants
from write_csv import writeDataToCSV
# TODO
# - Check Aaron's timestamps
# - Fix screen cap write out

# Where are we putting the output?
outputPrefix = "../FramesDataset/"

# Video frame extraction parameters
frameExtractFormat = "frame_{:08d}.png"
frameOutFormat = "frame_{:08d}_{:08d}.png"

# CSV File names
csvTempName = "gazePredictions.csv"
csvDoneName = "gazePredictionsDone.csv"

# Participant characteristics file

# Processors for messages




class WebSocketHandler(tornado.websocket.WebSocketHandler):

    def open(self):

        global_variables.participantPos = -1
        #send list of participants and videos to client
        showParticipants( self )
        #global_variables.participantSelectedDirList = global_variables.participantDirList
        #newParticipant( self )

 
    def on_message(self, message):
        
        #######################################################################################
        # Video requested from client
        #
        msg = tornado.escape.json_decode( message )
        if msg['msgID'] == '1':
            
            #######################################
            # Extract video frames and find timestamps
            # TODO: Refactor, but be careful. Prickly code
            #
            global_variables.participant.videosPos = global_variables.participant.videosPos + 1
            pv = global_variables.participant.videos[global_variables.participant.videosPos]
            video = global_variables.participant.directory + '/' + pv.filename
            print( "Processing video: " + video )

            #
            # Make dir for output video frames
            outDir = outputPrefix +  video + "_frames" + '/'
            if not os.path.isdir( outDir ):
                os.makedirs( outDir )


            # We may have already processed this video...
            gpCSVDone = outputPrefix + global_variables.participant.directory + '_' + pv.filename + '_' + csvDoneName
            gpCSV = outputPrefix + global_variables.participant.directory + '_'  + pv.filename + '_' + csvTempName
            print("gpCSV is ",gpCSV)
            if os.path.isfile(gpCSVDone ):
                print( "    " + gpCSVDone + " already exists and completed; moving on to next video...")
                sendVideoEnd( self )
                return
            elif os.path.isfile( gpCSV ):
                print( "    " + gpCSV + " exists but does not have an entry for each file; deleting csv and starting this video again...")
                print('writing header')
                os.remove(gpCSV)

                # Write the header for the new gazePredictions.csv file
                if global_variables.writeCSV:
                    with open(gpCSV, 'w', newline='' ) as csvfile:
                        writer = csv.DictWriter(csvfile, fieldnames=global_variables.fieldnames,
                            delimiter=',',quoting=csv.QUOTE_ALL)
                        writer.writeheader()
                        print('done writing?')
                        #return            

            # If we're not done, we need to extract the video frames (using ffmpeg).
            # If this is already done, we write 'framesExtracted.txt'
            #
            framesDoneFile = outDir + "framesExtracted.txt"
            if not os.path.isfile( framesDoneFile ):
                print( "    Extracting video frames (might take a few minutes)... " + str(video) )
                completedProcess = subprocess.run('ffmpeg -i "./' + video + '" -vf showinfo "' + outDir + 'frame_%08d.png"'\
                    , stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, shell=True)

                nFrames = len(glob.glob( outDir + '*.png' ))
                if nFrames == 0:
                    print( "    Error extracting video frames! Moving on to next video..." )
                    sendVideoEnd( self )
                    return

                # Collect the timestamps of the video frames
                allPts = np.ones(nFrames, dtype=np.int) * -1
                ptsTimebase = -1
                framerate = -1
                lines = completedProcess.stderr.splitlines()
                for l in lines:
                    if l.startswith( "[Parsed_showinfo_0 @" ):
                        timebase = l.find( "config in time_base:" )
                        fr = l.find( ", frame_rate:" )
                        nStart = l.find( "n:" )
                        ptsStart = l.find( "pts:" )
                        pts_timeStart = l.find( "pts_time:" )
                        if nStart >= 0 and ptsStart >= 0:
                            frameNum = int(l[nStart+2:ptsStart-1].strip())
                            pts = int(l[ptsStart+4:pts_timeStart].strip())
                            allPts[frameNum] = pts
                        elif timebase >= 0:
                            ptsTimebase = l[timebase+20:fr].strip()
                            framerate = l[fr+13:].strip()
                            sl = framerate.find("/")
                            if sl > 0:
                                frPre = framerate[0:sl]
                                frPost = framerate[sl+1:]
                                framerate = float(frPre) / float(frPost)
                            else:
                                framerate = float(framerate)

                            if ptsTimebase != "1/1000":
                                print( "ERROR ERROR Timebase in webm is not in milliseconds" )
                    # if l.startswith( "frame=" ):
                        # This is written out at the end of the file, and looks like this:
                        # frame=  454 fps= 51 q=24.8 Lsize=N/A time=00:00:15.13 bitrate=N/A dup=3 drop=1 speed=1.71x -  refers to decoding 

                # Some of the presentation times (pts) will not have been filled in, and will be -1s
                # Let's just assume the framerate is good (yea right) and add on the frame time to the last good
                prev = 0
                for i in range(0, nFrames):
                    if allPts[i] == -1:
                        allPts[i] = prev + int(1000/framerate)
                    prev = allPts[i]
                
                # TODO Write out this data to a pts file?

                # Rename the files based on their frame number and timestamp
                for i in range(0, nFrames):
                    inputFile = outDir + frameExtractFormat.format(i+1) # Catch that the output framenumbers from extraction start from 1 and not 0
                    outputFile = outDir + frameOutFormat.format(i, allPts[i])
                    os.rename( inputFile, outputFile )
                    
                
                with open( framesDoneFile, 'w' ) as f:
                    f.write( "Done." )


            # Populate list with video frames
            pv.frameFilesList = sorted(glob.glob( outDir + '*.png' ))
            pv.frameFilesPos = 0
            

            ########################################
            # Send the first video frame + timestamp
            #
            print('done extracting, sending frame')
            sendVideoFrame( self, pv.frameFilesList[pv.frameFilesPos], pv )
        # 
        # End NEW VIDEO
        #######################################################################################
        

        #######################################################################################
        # Feedback from CLIENT which contains the webgazer + interaction metadata we need...
        # 
        elif msg['msgID'] == '3':
            # Parse, manipulate the data and write to CSV
            frameTimeEpoch = writeDataToCSV( global_variables.participant, msg )

            if global_variables.writeScreenCapVideo:
                writeScreenCapOutputFrames( global_variables.participant, frameTimeEpoch )

            ##################################
            # Send the next frame of the video
            pv = global_variables.participant.videos[global_variables.participant.videosPos]
            pv.frameFilesPos = pv.frameFilesPos + 1
            
            # If the video frame is the last available video frame, send a message to this effect
            if pv.frameFilesPos >= len(pv.frameFilesList):

                if global_variables.writeScreenCapVideo:
                    closeScreenCapOutVideo( global_variables.participant )

                outDir = outputPrefix + global_variables.participant.directory + '/' + pv.filename + "_frames" + '/'
                gpCSV = outputPrefix + global_variables.participant.directory + '_' + pv.filename +'_' + csvTempName 
                gpCSVDone = outputPrefix + global_variables.participant.directory + '_'  + pv.filename + '_' + csvDoneName
                if os.path.isfile( gpCSV ):
                    os.rename( gpCSV, gpCSVDone )

                sendVideoEnd( self )

            else:
                sendVideoFrame( self, pv.frameFilesList[pv.frameFilesPos], pv )
        elif msg['msgID'] == '5':
            global_variables.participantSelectedDirList = sorted(msg['participants'])
            print('received participant message from user' ,global_variables.participantSelectedDirList)
            newParticipant(self)

    def on_close(self):
        pass

class Application(tornado.web.Application):
    def __init__(self):
        handlers = [
            (r'/websocket', WebSocketHandler),
            (r'/(.*)', tornado.web.StaticFileHandler, {'path': '.', 'default_filename': ''}),
        ]
 
        settings = {
            'template_path': 'templates'
        }
        tornado.web.Application.__init__(self, handlers, **settings)


def main():
    global_variables.init()

    ###########################################################################################################
    # Enumerate all P_ subdirectories if not yet done
    regex = re.compile('P_[0-9][0-9]')

    global_variables.participantDirList = []
    for root, dirs, files in os.walk('.'):
        for d in dirs:
            if regex.match(d):
               global_variables.participantDirList.append(d)

    global_variables.participantDirList = sorted( global_variables.participantDirList )

    # NOTE: This would be the point to filter any participants from the processing

    ###########################################################################################################
    # Setup webserver
    #
    listen_address = ''
    listen_port = 8000
    try:
        if len(sys.argv) == 2:
            listen_port = int(sys.argv[1])
        elif len(sys.argv) == 3:
            listen_address = sys.argv[1]
            listen_port = int(sys.argv[2])
        assert 0 <= listen_port <= 65535
    except (AssertionError, ValueError):
        raise ValueError('Port must be a number between 0 and 65535')

    args = sys.argv
    args.append("--log_file_prefix=myapp.log")
    tornado.log.enable_pretty_logging()
    tornado.options.parse_command_line(args)
    
    ws_app = Application()
    http_server = tornado.httpserver.HTTPServer(ws_app)
    http_server.listen(listen_port)

    # Logging
    logging.info('Listening on %s:%s' % (listen_address or '[::]' if ':' not in listen_address else '[%s]' % listen_address, listen_port))
    # [James]
    # Uncomment these lines to suppress normal webserver output
    logging.getLogger('tornado.access').disabled = True
    logging.getLogger('tornado.application').disabled = True
    logging.getLogger('tornado.general').disabled = True

    # Message
    print( "WebGazer ETRA2018 Dataset Extractor server started; please open http://localhost:8000/webgazerExtractClient.html" )

    #################################
    # Start webserver
    tornado.ioloop.IOLoop.instance().start()

if __name__ == '__main__':
    main()
