//카메라 설정 & 관리

let capture = document.createElement("video");
capture.playsinline = "playsinline";
capture.autoplay = "autoplay";

const defaultWidth = 640, defaultHeight = 480;
const scaleWidth = {min: defaultWidth};
const scaleHeight = {min: defaultHeight};
capture.width = defaultWidth;
capture.height = defaultHeight;

// 카메라 가져오기 (UI에서 사용)
// list cameras
function listCameras(cb){
    let carr = [];
    let count = 1;
    navigator.mediaDevices.enumerateDevices().then(darr =>
    {
        darr.forEach(mediaDevice =>
        {
            if(mediaDevice.kind === 'videoinput')
            {
                let id = mediaDevice.deviceId;
                let name = mediaDevice.label || `Camera ${count++}`;
                carr.push({"id": id, "name": name});
            }
        })
        cb(carr);
    });
}

// 비디오 ID 값 가져오기
// get current video device id
function getCurrentVideoId(){
    return capture.srcObject.getTracks()[0].getSettings()['deviceId'];
}

// 컨트롤.js에서 카메라 시작하기
// read video from webcam
function startCamera(cb){
    navigator.mediaDevices.getUserMedia({
        audio: false, video: {
            facingMode: 'user',
            width: scaleWidth,
            height: scaleHeight,
        }
    }).then(function(stream){
        console.log("video initialized");
        window.stream = stream;
        capture.srcObject = stream;
    });
    // signal when capture is ready
    capture.onloadeddata = cb;
    return capture;
}

// UI에서 변경 사항 발생하면 video 소스 수정
// change current video to a new source
let resetting = false;
function setVideoStream(deviceId, cb){
    // stop current video
    resetting = true;
    capture.srcObject.getTracks().forEach(track => {
        track.stop();
    });
    window.stream.getTracks().forEach(track => {
        track.stop();
    });
    navigator.mediaDevices.getUserMedia({
        audio: false, video: {
            deviceId: deviceId ? {exact: deviceId} : undefined,
            width: scaleWidth,
            height: scaleHeight,
        }
    }).then(function(stream){
        console.log("video stream set: ", deviceId);
        window.stream = stream;
        capture.srcObject = stream;
    });
    capture.onloadeddata = cb;
}

function reSettingDone(){
    resetting = false;
}

// 카메라에 맞추어 캔버스 사이즈 조절(?)
// set canvas context size with the camera
function linkCamera2Context(canvas, cr){
    capture.width = capture.videoWidth;
    capture.height = capture.videoHeight;
    canvas.width = Math.floor(
        capture.videoWidth * cr);
    canvas.height = Math.floor(
        capture.videoHeight * cr);
}

// video width and height
function getCameraWH(){
    return [capture.videoWidth, capture.videoHeight];
}

// return the capture as frame
function getCameraFrame(){
    return capture;
}

// validate image readiness
function checkImage(){
    if((capture.readyState === 4) && (!resetting)){
        return true;
    }else{
        return false;
    }
}