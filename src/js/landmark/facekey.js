// Face Point of Interests
// left right top down center
// https://i.stack.imgur.com/5Mohl.jpg

// 이건 tf 얼굴 특징점들의 인덱스 
const FPoI = {
    "head": [127, 356, 10, 152, 168],
    "righteye": [33, 133, 159, 145, 468],
    "lefteye": [362, 263, 386, 374, 473],
    "mouth": [78, 308, 13, 14],
    "rightbrow": [105, 107],
    "leftbrow": [336, 334]
};

// 사각형 박스의 가로 세로비를 계산 (비율 게산으로 눈과 입이 열렸는지 닫혔는지를 체크 )
function getOpenRatio(obj){
    let width = distance3d(obj[0], obj[1]);
    let height = distance3d(obj[2], obj[3]);
    return height / width;
}

//포즈에서 가로세로 비를 계산 
function getPosRatio(obj){
    let dleft = distance3d(obj[0], obj[4]);
    let dright = distance3d(obj[1], obj[4]);
    return dleft / (dleft + dright);
}

// 저위에 점들의 위치로 머리 각도 계산 
function getHeadRotation(head){

    let rollSlope = slope(0, 1, head[1], head[0]); //x, y 값으로 계산 
    let roll = Math.atan(rollSlope);
    let yawSlope = slope(0, 2, head[1], head[0]);  //x, z 값으로 계산 
    let yaw = Math.atan(yawSlope);
    let pitchSlope = slope(2, 1, head[2], head[3]); //y, z 값으로 계산 
    let pitch = Math.atan(pitchSlope);
    
    if(pitch > 0){
        pitch -= Math.PI;
    }
    return [roll, pitch + Math.PI / 2, yaw];
}

// 저 위에 점들로 위치값 계산 
function getHeadXYZ(head){
    let wh = getCameraWH();
    let topx = head[2][0];
    let topy = head[2][1];
    let downx = head[3][0];
    let downy = head[3][1];
    let x = Math.max(-1, Math.min(1, (topx + downx) / wh[0] - 1));
    let y = Math.max(-1, Math.min(1, (topy + downy) / wh[0] - 1));
    let z = Math.max(-1, Math.min(1, wh[1] / distance3d(head[2], head[3]) - 3));
    return [x, y, z]; //[ -1, 1] 사이 값으로 보정된 위치 
}

// 이건 입의 길이로 무언가를 계산하는데? (양수값을 반환하는 듯)
function getMoodAutoDraft(mouth){
    let mbalance = average3d(mouth[0], mouth[1]);
    let mmove = average3d(mouth[2], mouth[3]);
    let absauto = Math.min(1, distance2d(mbalance, mmove) / distance3d(mouth[0], mouth[1]));
    if(mbalance[1] > mmove[1]){ // compare Y
        return -absauto;
    }else{
        return absauto;
    }
}

//Mood 계산을 무언가 해서 양수값을 반환하는 데? 
function getMoodAuto(autoDraft, headRotate){
    let absYaw = Math.abs(headRotate[2]);
    if(autoDraft > 0){
        return Math.max(0, autoDraft - absYaw / 1.5);
    }else{
        return Math.min(0, autoDraft + absYaw / 1.5);
    }
}

//눈썹 관련 비율을 계산하는 듯 
function getBrowsRatio(face){
    let htop = face["head"][2];
    let hmid = face["head"][4];
    let letop = face["lefteye"][2];
    let retop = face["righteye"][2];
    let d1 = distance3d(face["rightbrow"][0], htop) +
        distance3d(face["rightbrow"][1], htop) +
        distance3d(face["leftbrow"][0], htop) +
        distance3d(face["leftbrow"][1], htop);
    let d2 = distance3d(face["rightbrow"][0], hmid) +
        distance3d(face["rightbrow"][1], hmid) +
        distance3d(face["leftbrow"][0], hmid) +
        distance3d(face["leftbrow"][1], hmid);
    return d2 / (d1 + d2);
}

//머리, 눈, 입, 몸 그룹별 민감도 계산할 때 사용  
function getKeyType(key){
    if(["roll", "pitch", "yaw"].includes(key)){
        return "head";
    }else if(["leftEyeOpen", "rightEyeOpen", "irisPos"].includes(key)){
        return "eye";
    }else if(["mouth"].includes(key)){
        return "mouth";
    }else{
        return "body";
    }
}

//얼굴 정보는 여기에 담아서 전달 (이걸 일단 전달한다.)
function face2Info(face){
    let keyInfo = {};
    let headRotate = getHeadRotation(face["head"]);
    let headXYZ = getHeadXYZ(face["head"]);
    let autoDraft = getMoodAutoDraft(face["mouth"]);
    keyInfo["roll"] = headRotate[0];
    keyInfo["pitch"] = headRotate[1];
    keyInfo["yaw"] = headRotate[2];
    keyInfo["leftEyeOpen"] = getOpenRatio(face["lefteye"]);
    keyInfo["rightEyeOpen"] = getOpenRatio(face["righteye"]);
    keyInfo["irisPos"] = getPosRatio(face["lefteye"]) + getPosRatio(face["righteye"]) - 1;
    keyInfo["mouth"] = Math.max(0, getOpenRatio(face["mouth"]) - Math.abs(headRotate[1] / 10));
    keyInfo["brows"] = getBrowsRatio(face);
    keyInfo["x"] = headXYZ[0];
    keyInfo["y"] = headXYZ[1];
    keyInfo["z"] = headXYZ[2];
    keyInfo["auto"] = getMoodAuto(autoDraft, headRotate);
    return keyInfo;
}

// reduce vertices to the desired set, and compress data as well
function packFaceHolistic(_face){
    let wh = getCameraWH();
    function pointUnpack(p){
        return [p.x * wh[0], p.y * wh[1], p.z * wh[1]];  // [-1,1] 값을 화면 크기로 스케일링 하는 듯 
    }
    let ret = {};
    Object.keys(FPoI).forEach(function(key){
        ret[key] = [];
        for(let i = 0; i < FPoI[key].length; i++){
            ret[key][i] = pointUnpack(_face[FPoI[key][i]]);
        }
    });
    return ret; //이거 출력해서 한번 봐야 할 듯 (저 점들 모아서 전달하는 것 같은데)
}
