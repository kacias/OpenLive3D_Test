// Post Point of Interests
// left right
// https://google.github.io/mediapipe/solutions/pose.html


//이건 미디어파이프에 본 인덱스 
const PPoI = {
    "elbow": [13, 14],
    "shoulder": [11, 12],
    "wrist": [15, 16],
};

//(오른쪽, 왼쪽) 어깨와 팔꿈치 간의 Up, Front벡터 계산 (나중에 사용해야 할 듯)
function getElbowUpFront(pose, leftright){
    let shoulder = pose["shoulder"][leftright];
    let elbow = pose["elbow"][leftright];
    let d = distance3d(shoulder, elbow);
    let up = (shoulder[1] - elbow[1]) / d;     //y값 계산 
    let front = (shoulder[2] - elbow[2]) / d;  //z값 계산 
    return [up, front];
}

// Down   //    0   0  70 //  -20 -30  10
// Down/2 //    0   5  65 //  -10 -85   5
// Middle //    0  10  60 //    0 -140  0
// Up/2   //    0 -30  -5 //    0 -80 -40
// Up     //    0 -70 -70 //    0 -10   0

//(오른쪽, 왼쪽) 손목 위치 계산 (어깨 길이를 상대 기준으로 잡아서 계산함)
function getWristXYZ(pose, leftright){
    let base = distance3d(pose["shoulder"][0], pose["shoulder"][1]) * 1.2;
    let shoulder = pose["shoulder"][leftright];
    let wrist = pose["wrist"][leftright];
    let x = Math.max(-1, Math.min(1, (shoulder[0] - wrist[0]) / base));  //[-1,1] 사이로 정규화 
    let y = Math.max( 0, Math.min(1, (shoulder[1] - wrist[1]) / base / 2 + 0.5));  //[0,1] 사이로 정규화 
    let z = +(wrist[2] > shoulder[2]);
    return [x, y, z];
}

//어깨값으로 y,z값 계산 
function getTiltLean(shoulder){
    let d = distance3d(shoulder[0], shoulder[1]);  //기준 길이를 잡고 
    let tilt = (shoulder[0][1] - shoulder[1][1]) / d;  //y값 차이 계산 
    let lean = (shoulder[0][2] - shoulder[1][2]) / d;  //z값 차이 계산  
    return [tilt, lean * Math.sqrt(Math.abs(lean))]; 
}

//몸 정보 취합 
function pose2Info(pose){
    let keyInfo = {};
    let tl = getTiltLean(pose["shoulder"]);
    let lwrist = getWristXYZ(pose, 0);
    let rwrist = getWristXYZ(pose, 1);
    keyInfo["tilt"] = tl[0];
    keyInfo["lean"] = tl[1];
    keyInfo["leftWristX"] = lwrist[0];
    keyInfo["leftWristY"] = lwrist[1];
    keyInfo["rightWristX"] = rwrist[0];
    keyInfo["rightWristY"] = rwrist[1];
    return keyInfo;
}

//점 위치를 배열로 정리해서 전달 
function packPoseHolistic(_pose){
    let wh = getCameraWH();
    function pointUnpack(p){
        return [p.x * wh[0], p.y * wh[1], p.z * wh[1]];
    }
    let ret = {};
    Object.keys(PPoI).forEach(function(key){
        ret[key] = [];
        for(let i = 0; i < PPoI[key].length; i++){
            ret[key][i] = pointUnpack(_pose[PPoI[key][i]]);
        }
    });
    return ret;
}