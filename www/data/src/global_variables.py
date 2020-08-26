def init():
    global tobiiCurrentX, tobiiCurrentY
    global participant
    global writeScreenCapVideo, useAaronCircles
    global wgCurrentX, wgCurrentY
    global pctFile
    global participantPos, participantDirList, participantSelectedDirList
    global onlyWritingVideos
    # Options
    
    onlyWritingVideos = True    # Only process videos where the participant is asked to write into a text field
    writeScreenCapVideo = False
    useAaronCircles = False

    # global_variables for current state of eye tracking
    tobiiCurrentX = 0
    tobiiCurrentY = 0
    wgCurrentX = 0
    wgCurrentY = 0


    # Which participant are we on?
    participantPos = -1
    participant = []
