import csv
import global_variables
# p = participant
def writeDataToCSV( p, msg ):

    ###########################################################################################################
    # Store current WebGazer prediction from browser
    global_variables.wgCurrentX = float( msg["webGazerX"] )
    global_variables.wgCurrentY = float( msg["webGazerY"] )
    wgError = float( msg["error"] )
    wgErrorPix = float( msg["errorPix"] )


    ###########################################################################################################
    # Find the closest Tobii timestamp to our current video timestamp
    #
    # As time only goes forwards, tobiiListPos is a counter which persists over GET requests.
    # The videos arrive in non-chronological order, however, so we have to reset tobiiListPos on each new video
    frameTimeEpoch = int( msg["frameTimeEpoch"] )
    while p.tobiiListPos < len(p.tobiiList)-2 and frameTimeEpoch - p.tobiiList[p.tobiiListPos].timestamp > 0:
        p.tobiiListPos = p.tobiiListPos + 1

    if p.tobiiListPos == len(p.tobiiList):
        # We've come to the end of the list and there are no more events...
        print( "Error: at end of Tobii event list; no matching timestamp" )
        global_variables.tobiiCurrentX = -1
        global_variables.tobiiCurrentY = -1
    else:
        # TobiiList
        diffCurr = frameTimeEpoch - p.tobiiList[p.tobiiListPos].timestamp
        diffNext = frameTimeEpoch - p.tobiiList[p.tobiiListPos+1].timestamp

        # Pick the one which is closest in time
        if abs(diffCurr) < abs(diffNext):
            td = p.tobiiList[p.tobiiListPos]
        else:
            td = p.tobiiList[p.tobiiListPos+1]

        # Check validity for return value
        if td.rightEyeValid == 1 and td.leftEyeValid == 1:
            global_variables.tobiiCurrentX = (td.leftScreenGazeX + td.rightScreenGazeX) / 2.0
            global_variables.tobiiCurrentY = (td.leftScreenGazeY + td.rightScreenGazeY) / 2.0
        elif td.rightEyeValid == 1 and td.leftEyeValid == 0:
            global_variables.tobiiCurrentX = td.rightScreenGazeX
            global_variables.tobiiCurrentY = td.rightScreenGazeY
        elif td.rightEyeValid == 0 and td.leftEyeValid == 1:
            global_variables.tobiiCurrentX = td.leftScreenGazeX
            global_variables.tobiiCurrentY = td.leftScreenGazeY
        else:
            # Neither is valid, so we could either leave it as the previous case,
            # which involves doing nothing, or set it to -1.
            global_variables.tobiiCurrentX = -1
            global_variables.tobiiCurrentY = -1

    ###################################################
    # Work out what to write out to CSV
    out = msg
    del out['msgID']
    out['participant'] = p.directory
    pv = p.videos[p.videosPos]
    out['frameImageFile'] = pv.frameFilesList[ pv.frameFilesPos ]
    
    out["tobiiLeftScreenGazeX"] = td.leftScreenGazeX
    out["tobiiLeftScreenGazeY"] = td.leftScreenGazeY
    out["tobiiRightScreenGazeX"] = td.rightScreenGazeX
    out["tobiiRightScreenGazeY"] = td.rightScreenGazeY

    out['error'] = wgError
    out['errorPix'] = wgErrorPix

    # Turn fmPos and eyeFeatures into per-column values
    fmPosDict = dict(zip( global_variables.fmPosKeys, list(chain.from_iterable( out["fmPos"] )) ) )
    eyeFeaturesDict = dict(zip( global_variables.eyeFeaturesKeys, out["eyeFeatures"] ))
    out.update( fmPosDict )
    out.update( eyeFeaturesDict )
    del out['fmPos']
    del out['eyeFeatures']

    if global_variables.writeCSV:

        # A reminder of what the desired field name outputs are.
        # fieldnames = (['participant','frameImageFile','frameTimeEpoch','frameNum','mouseMoveX','mouseMoveY','mouseClickX','mouseClickY','keyPressed','keyPressedX','keyPressedY',
        #                'tobiiLeftScreenGazeX','tobiiLeftScreenGazeY','tobiiRightScreenGazeX','tobiiRightScreenGazeY','webGazerX','webGazerY','fmPos','eyeFeatures','wgError','wgErrorPix'])

        # Target dir for output
        outDir = outputPrefix + global_variables.participant.directory + '/' + \
            global_variables.participant.videos[global_variables.participant.videosPos].filename \
            + "_frames" + '/'
        # Target gaze predictions csv
        gpCSV = outputPrefix + global_variables.participant.directory + '_'  + pv.filename + '_' + csvTempName 
        with open( gpCSV, 'a', newline='' ) as f:
            # Note no quotes between fmTracker and eyeFeatures
            # f.write( "\"" + participant.directory + "\",\"" + fname + "\",\"" + str(frameTimeEpoch) + "\",\"" + str(frameNum) + "\",\"" + str(mouseMoveX) + "\",\"" + str(mouseMoveY) + "\",\"" + str(mouseClickX) + "\",\"" + str(mouseClickY) + "\",\"" + keyPressed + "\",\"" + str(keyPressedX) + "\",\"" + str(keyPressedY) + "\",\"" + str(td.leftScreenGazeX) + "\",\"" + str(td.leftScreenGazeY) + "\",\"" + str(td.rightScreenGazeX) + "\",\"" + str(td.rightScreenGazeY) + "\",\"" + str(wgCurrentX) + "\",\"" + str(wgCurrentY) + "\"," + str(fmPos) + "," + str(eyeFeatures) + "\n")
            writer = csv.DictWriter(f, fieldnames=global_variables.fieldnames,delimiter=',',quoting=csv.QUOTE_ALL)
            writer.writerow( out )

    return frameTimeEpoch
################################################################################################
