def init():
    global tobiiCurrentX, tobiiCurrentY
    global participant
    global writeScreenCapVideo, useAaronCircles
    global wgCurrentX, wgCurrentY
    global pctFile
    global participantPos, participantDirList, participantSelectedDirList
    global onlyWritingVideos
    global writeCSV
    # Options
    
    onlyWritingVideos = True    # Only process videos where the participant is asked to write into a text field
    writeScreenCapVideo = False
    useAaronCircles = False
    writeCSV = True

    # global_variables for current state of eye tracking
    tobiiCurrentX = 0
    tobiiCurrentY = 0
    wgCurrentX = 0
    wgCurrentY = 0


    # Which participant are we on?
    participantPos = -1
    participant = []

    fmPosKeys = ['fmPos_%04d' % i for i in range(0, 468)]
    eyeFeaturesKeys = ['eyeFeatures_%04d' % i for i in range(0, 120)]
    fieldnames = (['participant','frameImageFile','frameTimeEpoch','frameNum','mouseMoveX','mouseMoveY',
                   'mouseClickX','mouseClickY','keyPressed','keyPressedX','keyPressedY',
                   'tobiiLeftScreenGazeX','tobiiLeftScreenGazeY','tobiiRightScreenGazeX','tobiiRightScreenGazeY'])
    fieldnames.extend( fmPosKeys )
    fieldnames.extend( eyeFeaturesKeys )
