//메인 함수 (여기서 캐릭터 본의 위치를 업데이트함)

// global scene, light, and clock variable
let scene = new THREE.Scene();
let light = new THREE.DirectionalLight(0xffffff);
light.position.set(0.0, 1.0, -1.0).normalize();
scene.add(light);
let clock = new THREE.Clock();
clock.start();

// config
let Tvrmsbspn = THREE.VRMSchema.BlendShapePresetName;
let Tvrmshbn = THREE.VRMSchema.HumanoidBoneName;
let cm = getCM(); // required for ConfigManager Setup
let currentVrm = undefined; //읽어들인 VRM 모델 
let defaultXYZ = undefined; //모델 기본 위치   

// initialize / reinitialize VRM (초기화 단계에서 캐릭터 읽어들이는 함수)
function loadVRM(vrmurl)
{
    loadVRMModel(vrmurl,
        function(vrm){

            if(currentVrm){
                scene.remove(currentVrm.scene);
                currentVrm.dispose();
            }
            currentVrm = vrm;
            scene.add(vrm.scene);
            let head = currentVrm.humanoid.getBoneNode(Tvrmshbn.Head);
            let foot = currentVrm.humanoid.getBoneNode(Tvrmshbn.LeftFoot);
            let pos = {
                "x": head.up.x + head.position.x,
                "y": head.up.y + head.position.y - foot.position.y,
                "z": head.up.z + head.position.z
            };
            resetCameraPos(pos);
            resetVRMMood();
            createMoodLayout();

            let hips = currentVrm.humanoid.getBoneNode(Tvrmshbn.Hips).position;
            defaultXYZ = [hips.x, hips.y, hips.z];
            console.log("vrm model loaded");
            console.log(currentVrm);
        });
    setMood(getCMV('DEFAULT_MOOD'));
}

//========================================================
// 초기화 함수
// initialize the control
function initialize(){

    // html canvas for drawing debug view
    // UI gui-laytout.js 함수 실행
    createLayout();

    // start video (카메라를 보여줘야 하므로 있어야 함)
    startCamera(setCameraCallBack);

    // load holistic (비동기 함수를 인자로 넘김)
    loadHolistic(onHolisticResults, function(){
        console.log("holistic model connected");
    });

    // load vrm model
    loadVRM(getCMV('MODEL'));

    console.log("controller initialized");
}

function radLimit(rad){
    let limit = Math.PI / 2;
    return Math.max(-limit, Math.min(limit, rad));
}

function ratioLimit(ratio){
    return Math.max(0, Math.min(1, ratio));
}

//최하위 입/눈 정점 이동 (블랜드 쉐이프로 처리)
function updateMouthEyes(keys){
    if(currentVrm && mood != Tvrmsbspn.Joy){
        let Cbsp = currentVrm.blendShapeProxy;
        let Ch = currentVrm.humanoid;
        // mouth
        let mouthRatio = ratioLimit((keys['mouth'] - getCMV("MOUTH_OPEN_OFFSET")) * getCMV('MOUTH_RATIO'));
        Cbsp.setValue(Tvrmsbspn.A, mouthRatio);
        // eyes
        let leo = keys['leftEyeOpen'];
        let reo = keys['rightEyeOpen'];
        if(getCMV("EYE_SYNC") || Math.abs(reo - leo) < getCMV('EYE_LINK_THRESHOLD')){
            let avgEye = (reo + leo) / 2;
            leo = avgEye;
            reo = avgEye;
        }
        if(reo < getCMV('RIGHT_EYE_CLOSE_THRESHOLD')){
            Cbsp.setValue(Tvrmsbspn.BlinkR, 1);
        }else if(reo < getCMV('RIGHT_EYE_OPEN_THRESHOLD')){
            let eRatio = (reo - getCMV('RIGHT_EYE_CLOSE_THRESHOLD')) / (getCMV('RIGHT_EYE_OPEN_THRESHOLD') - getCMV('RIGHT_EYE_CLOSE_THRESHOLD'));
            Cbsp.setValue(Tvrmsbspn.BlinkR, ratioLimit((1 - eRatio) * getCMV('RIGHT_EYE_SQUINT_RATIO')));
        }else{
            Cbsp.setValue(Tvrmsbspn.BlinkR, 0);
        }
        if(leo < getCMV('LEFT_EYE_CLOSE_THRESHOLD')){
            Cbsp.setValue(Tvrmsbspn.BlinkL, 1);
        }else if(leo < getCMV('LEFT_EYE_OPEN_THRESHOLD')){
            let eRatio = (leo - getCMV('LEFT_EYE_CLOSE_THRESHOLD')) / (getCMV('LEFT_EYE_OPEN_THRESHOLD') - getCMV('LEFT_EYE_CLOSE_THRESHOLD'));
            Cbsp.setValue(Tvrmsbspn.BlinkL, ratioLimit((1 - eRatio) * getCMV('LEFT_EYE_SQUINT_RATIO')));
        }else{
            Cbsp.setValue(Tvrmsbspn.BlinkL, 0);
        }

        // irises
        let irispos = keys['irisPos'];
        let irisY = (irispos - getCMV('IRIS_POS_OFFSET')) * getCMV('IRIS_POS_RATIO');
        let riris = Ch.getBoneNode(Tvrmshbn.RightEye).rotation;
        let liris = Ch.getBoneNode(Tvrmshbn.LeftEye).rotation;
        riris.y = irisY;
        liris.y = irisY;
        // eyebrows
        if(checkVRMMood("Brows up")){
            let browspos = Math.min(1, Math.max(0, keys['brows'] - getCMV("BROWS_OFFSET")) * getCMV("BROWS_RATIO"));
            Cbsp.setValue("Brows up", browspos);
        }
        // auto mood
        if(mood == "AUTO_MOOD_DETECTION"){
            let autoV = Math.max(-1, Math.min(1, keys["auto"] * getCMV("MOOD_AUTO_RATIO")));
            let absauto = Math.max(0, Math.abs(autoV) - getCMV("MOOD_AUTO_OFFSET"));
            let balFun = 0;
            let balSor = 0;
            let balAng = 0;
            if(!checkVRMMood("Brows up")){
                let browspos = Math.min(1, Math.max(0, keys['brows'] - getCMV("BROWS_OFFSET")) * getCMV("BROWS_RATIO"));
                let browslimit = 0.1;
                balFun = Math.min(browslimit, Math.max(0, browspos));
                balSor = Math.min(browslimit / 2, Math.max(0, (browslimit - balFun) / 2));
                balAng = Math.min(browslimit / 2, Math.max(0, (browslimit - balFun) / 2));
            }
            if(autoV < 0){
                Cbsp.setValue(Tvrmsbspn.Angry, balAng);
                Cbsp.setValue(Tvrmsbspn.Sorrow, absauto + balSor);
                Cbsp.setValue(Tvrmsbspn.Fun, balFun);
                Cbsp.setValue(Tvrmsbspn.E, 0);
            }else{
                Cbsp.setValue(Tvrmsbspn.Angry, balAng);
                Cbsp.setValue(Tvrmsbspn.Sorrow, balSor);
                Cbsp.setValue(Tvrmsbspn.Fun, absauto + balFun);
                Cbsp.setValue(Tvrmsbspn.E, absauto);
            }
        }
    }
}

//중요 (여기에 회전 정보 들어 있음. 이걸 오브젝트로 만들어서 전달)
//몸 위치 업데이트 (본 회전으로 처리)
function updateBody(keys){
    let updateTime = new Date().getTime();
    if(currentVrm){
        let Ch = currentVrm.humanoid;
        let tiltRatio = Math.min(0.2, Math.max(-0.2, keys['tilt']));
        let leanRatio = Math.min(1, Math.max(-1, keys['lean'])) * 0.6;

        // head (각도값을 넘기는 곳) (머리)
        let head = Ch.getBoneNode(Tvrmshbn.Head).rotation;
        head.set(
            radLimit(keys['pitch'] * getCMV('HEAD_RATIO')),
            radLimit(keys['yaw'] * getCMV('HEAD_RATIO') - leanRatio * 0.3),
            radLimit(keys['roll'] * getCMV('HEAD_RATIO') - tiltRatio * 0.3));

        // neck (목)
        let neck = Ch.getBoneNode(Tvrmshbn.Neck).rotation;
        neck.set(
            radLimit(keys['pitch'] * getCMV('NECK_RATIO')),
            radLimit(keys['yaw'] * getCMV('NECK_RATIO') - leanRatio * 0.7),
            radLimit(keys['roll'] * getCMV('NECK_RATIO') - tiltRatio * 0.7));

        // chest (가슴)
        let chest = Ch.getBoneNode(Tvrmshbn.Spine).rotation;
        chest.set(
            radLimit(keys['pitch'] * getCMV('CHEST_RATIO')),
            radLimit(keys['yaw'] * getCMV('CHEST_RATIO') + leanRatio),
            radLimit(keys['roll'] * getCMV('CHEST_RATIO') + tiltRatio));

        // left right arm
        if(getCMV('HAND_TRACKING'))
        {
            for(let i = 0; i < 2; i ++)
            {
                if(updateTime - handTrackers[i] < 1000 * getCMV('HAND_CHECK'))
                {
                    let prefix = ["left", "right"][i];

                    // upperArm, lowerArm
                    let wx = keys[prefix + "WristX"];
                    let wy = keys[prefix + "WristY"];
                    let hy = keys[prefix + 'Yaw'];
                    let hr = keys[prefix + 'Roll'];
                    let hp = keys[prefix + 'Pitch'];

                    let armEuler = armMagicEuler(wx, wy, hy, hr, hp, i);

                    Object.keys(armEuler).forEach(function(armkey)
                    {
                        let armobj = Ch.getBoneNode(prefix + armkey).rotation;

                        // console.log("===========================")
                        // console.log(armobj);
                        // console.log(armEuler[armkey]);

                        armobj.copy(armEuler[armkey]);

                    });

                }else{

                    setDefaultHand(currentVrm, i);
                }
            }
        }else{
            setDefaultPose(currentVrm);
        }
    }
}
//위치 업데이트 기능
function updatePosition(keys){
    if(currentVrm && defaultXYZ){
        let Ch = currentVrm.humanoid;
        let hips = Ch.getBoneNode(Tvrmshbn.Hips).position;
        hips.x = defaultXYZ[0] - keys['x'] * getCMV("POSITION_X_RATIO");
        hips.y = defaultXYZ[1] - keys['y'] * getCMV("POSITION_Y_RATIO");
        hips.z = defaultXYZ[2] + keys['z'] * getCMV("POSITION_Z_RATIO");
    }
}
// 숨쉬는 기능
function updateBreath(){
    if(currentVrm){
        let Ch = currentVrm.humanoid;
        // breath offset
        let bos = getCMV("BREATH_STRENGTH") / 100 * Math.sin(clock.elapsedTime * Math.PI * getCMV('BREATH_FREQUENCY'));
        if(isNaN(bos)){
            bos = 0.0;
        }
        // hips
        let hips = Ch.getBoneNode(Tvrmshbn.Hips).position;
        hips.y += bos;
    }
}
//무드 기능
function updateMood(){
    if(mood != oldmood){
        console.log(mood, oldmood);
        let Cbsp = currentVrm.blendShapeProxy;
        if(oldmood != "AUTO_MOOD_DETECTION"){
            Cbsp.setValue(oldmood, 0);
        }else{
            Cbsp.setValue(Tvrmsbspn.Angry, 0);
            Cbsp.setValue(Tvrmsbspn.Sorrow, 0);
            Cbsp.setValue(Tvrmsbspn.Fun, 0);
            Cbsp.setValue(Tvrmsbspn.E, 0);
        }
        if(mood != "AUTO_MOOD_DETECTION"){
            Cbsp.setValue(mood, 1);
        }
        oldmood = mood;
    }
}

//여기가 각 파트별로 애니메이션 시키는 곳  
function updateInfo(){
    let info = getInfo();

    //여기에서 값이 넘어가서 각도 계산이 이루어지는 듯
    //console.log("[info]==========================");
    //console.log(info);

    /*
    auto:0.07867722266949648
    brows: 0.4481873444967822
    irisPos:-0.017286188168792523
    lean -0.10606498105550805
    leftEyeOpen: 0.33287117693903256
    leftIndex:.9999988866445463
    leftLittle:0.9999988866445463
    leftMiddle:0.9999988866445463
    leftPitch:3.141589155880476
    leftRing:0.9999988866445463
    leftRoll:0
    leftSpread:0
    leftThumb:0.9999988866445463
    leftWristX:0.03658981387864098
    leftWristY:0.05556795043153717
    leftYaw:0
    mouth:-0.005261183713858385
    pitch:-0.17398836204284468
    rightEyeOpen:0.2653168473598721
    rightIndex:0.9999988866445463
    rightLittle:0.9999988866445463
    rightMiddle:0.9999988866445463
    rightPitch:3.141589155880476
    rightRing:0.9999988866445463
    rightRoll:0
    rightSpread:0
    rightThumb: 0.9999988866445463
    rightWristX:0.09956428100597241
    rightWristY:0.09760209585839423
    rightYaw: 0
    roll:0.06589646336307686
    tilt:-0.019277885374932798
    x:-0.11807528550183102
    y:0.0674567542524225
    yaw:.00994849653141789
    z:-0.49493664513577135
    */

    updateBody(info);
    updatePosition(info);

    //아래 2개는 옵션 (불활성화 함)
    //updateBreath();
    //updateMood();
}

// Mood
let defaultMoodList = ['angry', 'sorrow', 'fun', 'joy', 'surprised', 'relaxed', 'neutral', 'auto'];
let moodMap = {
    "angry": Tvrmsbspn.Angry,
    "sorrow": Tvrmsbspn.Sorrow,
    "fun": Tvrmsbspn.Fun,
    "joy": Tvrmsbspn.Joy,
    "surprised": "Surprised",
    "relaxed": "Relaxed",
    "neutral": Tvrmsbspn.Neutral,
    "auto": "AUTO_MOOD_DETECTION"
};
let mood = Tvrmsbspn.Neutral;
let oldmood = Tvrmsbspn.Neutral;
function getAllMoods(){
    let validmoods = [];
    Object.keys(moodMap).forEach(function(key){
        if(defaultMoodList.includes(key)){
            if(getCMV("MOOD_" + key.toUpperCase())){
                validmoods.push(key);
            }
        }
    });
    Object.keys(moodMap).forEach(function(key){
        if(!defaultMoodList.includes(key)){
            validmoods.push(key);
        }
    });
    return validmoods;
}
function getMood(){
    return mood;
}
function setMood(newmood){
    oldmood = mood;
    mood = moodMap[newmood];
}

// face landmark resolver
function onFaceLandmarkResult(keyPoints, faceInfo){
    if(faceInfo){
        Object.keys(faceInfo).forEach(function(key){
            let sr = getSR(getKeyType(key)) / getCMV("SENSITIVITY_SCALE");
            tmpInfo[key] = (1-sr) * faceInfo[key] + sr * tmpInfo[key];
        });
        updateMouthEyes(tmpInfo);
    }
}

// pose landmark resolver
function onPoseLandmarkResult(keyPoints, poseInfo){
    if(poseInfo){
        Object.keys(poseInfo).forEach(function(key){
            let sr = getSR(getKeyType(key)) / getCMV("SENSITIVITY_SCALE");
            tmpInfo[key] = (1-sr) * poseInfo[key] + sr * tmpInfo[key];
        });
    }    
}

// hand landmark resolver
let fingerRates = {"Thumb": 0.8, "Index": 0.7, "Middle": 0.7, "Ring": 0.7, "Little": 0.6};
let spreadRates = {"Index": -30, "Middle": -10, "Ring": 10, "Little": 30};
let fingerSegs = ["Distal", "Intermediate", "Proximal"];
let thumbRatios = [40, 60, 20];
let thumbSwing = 20;
let handTrackers = [new Date().getTime(), new Date().getTime()];

function onHandLandmarkResult(keyPoints, handInfo, leftright)
{
    let prefix = ["left", "right"][leftright];
    let preRate = 1 - leftright * 2;
    if(handInfo){
        handTrackers[leftright] = new Date().getTime();
        Object.keys(handInfo).forEach(function(key){
            let sr = getSR('hand') / getCMV("SENSITIVITY_SCALE");
            if(key in tmpInfo){
                tmpInfo[key] = (1-sr) * handInfo[key] + sr * tmpInfo[key];
            }
        });
        let Ch = currentVrm.humanoid;
        Object.keys(fingerRates).forEach(function(finger){
            let fingerRate = fingerRates[finger] * getCMV("FINGER_GRIP_RATIO");
            let spreadRate = spreadRates[finger] * getCMV("FINGER_SPREAD_RATIO");
            let preRatio = tmpInfo[prefix + finger];
            let _ratio = 1 - Math.max(0, Math.min(fingerRate, preRatio)) / fingerRate;
            let preSpread = tmpInfo[prefix + "Spread"];
            if(preRatio < 0){
                preSpread = 0.1;
            }
            let _spread = Math.min(1, Math.max(-0.2, preSpread - 0.1)) * spreadRate;
            if(finger == "Thumb"){
                for(let i = 0; i < fingerSegs.length; i ++){
                    let seg = fingerSegs[i];
                    let ratio = preRate * _ratio * thumbRatios[i] / 180 * Math.PI;
                    let swing = preRate * (0.5 - Math.abs(0.5 - _ratio)) * thumbSwing / 180 * Math.PI;
                    let frotate = Ch.getBoneNode(prefix + finger + seg).rotation;
                    frotate.set(0, ratio, swing);
                }
            }else{
                let ratio = preRate * _ratio * 70 / 180 * Math.PI;
                let spread = preRate * _spread / 180 * Math.PI;
                for(seg of fingerSegs){
                    let frotate = Ch.getBoneNode(prefix + finger + seg).rotation;
                    if(seg == "Proximal"){
                        frotate.set(0, spread, ratio);
                    }else{
                        frotate.set(0, 0, ratio);
                    }
                }
            }
        });
    }
}

function noHandLandmarkResult(leftright){
    let prefix = ["left", "right"][leftright];
    let tmpHandInfo = getDefaultHandInto(leftright);
    Object.keys(tmpHandInfo).forEach(function(key){
        let sr = getSR(getKeyType(key));
        if(key in tmpInfo){
            tmpInfo[key] = (1-sr) * tmpHandInfo[key] + sr * tmpInfo[key];
        }
    });
    let Ch = currentVrm.humanoid;
    Object.keys(fingerRates).forEach(function(finger){
        for(seg of fingerSegs){
            let frotate = Ch.getBoneNode(prefix + finger + seg).rotation;
            frotate.set(frotate.x * 0.8, frotate.y * 0.8, frotate.z * 0.8);
        }
    });
}

// obtain Holistic Result
let firstTime = true;
let tween = null;
let tmpInfo = getDefaultInfo();

//비동기 함수 로드되면서 실행 
async function onHolisticResults(results)
{
    let updateTime = new Date().getTime();
    if(firstTime){
        hideLoadbox();
        setInterval(checkFPS, 1000 * getCMV("FPS_RATE"));
        console.log("ml & visual loops validated");
        console.log("1st Result: ", results);
    }

    clearDebugCvs();

    //여기를 키면 카메라가 보임 
    if(getCMV('DEBUG_IMAGE')){
        drawImage(getCameraFrame());   //카메라에서 frame을 가져와서 그림을 그린다.
    }


    //전역 정보 
    let PoI = {};
    let allInfo = {};

    //얼굴 표정 탐지
    if(results.faceLandmarks){
        let keyPoints = packFaceHolistic(results.faceLandmarks);
        mergePoints(PoI, keyPoints);
        let faceInfo = face2Info(keyPoints);
        allInfo["face"] = faceInfo;  //모든 정보 여기에 담음
        onFaceLandmarkResult(keyPoints, faceInfo);
    }

    //포즈 생성 (미디어 파이프 점들을 VRM으로)
    if(results.poseLandmarks){
        let keyPoints = packPoseHolistic(results.poseLandmarks);
        mergePoints(PoI, keyPoints);
        //console.log("[keyPoints]///////////////////");
        //console.log(keyPoints);

        let poseInfo = pose2Info(keyPoints);
        allInfo["pose"] = poseInfo;  //모든 정보 여기에 담음

        //console.log("allInfo[pose]///////////////////");
        //console.log(allInfo["pose"]);

        onPoseLandmarkResult(keyPoints, poseInfo);
    }

    //왼쪽 손 포즈 생성
    if(results.leftHandLandmarks){
        let keyPoints = packHandHolistic(results.leftHandLandmarks, 0);
        mergePoints(PoI, keyPoints);
        let handInfo = hand2Info(keyPoints, 0);
        allInfo["left_hand"] = handInfo; //모든 정보 여기에 담음
        onHandLandmarkResult(keyPoints, handInfo, 0);
    }else if(updateTime - handTrackers[0] > 1000 * getCMV('HAND_CHECK')){
        noHandLandmarkResult(0);
    }

    //오른쪽 손 포즈 생성
    if(results.rightHandLandmarks){
        let keyPoints = packHandHolistic(results.rightHandLandmarks, 1);
        mergePoints(PoI, keyPoints);
        let handInfo = hand2Info(keyPoints, 1);
        allInfo["right_hand"] = handInfo;
        onHandLandmarkResult(keyPoints, handInfo, 1);
    }else if(updateTime - handTrackers[1] > 1000 * getCMV('HAND_CHECK')){
        noHandLandmarkResult(1);
    }

    //===============================================
    //여기가 한전 가공된 값이 담긴 곳. 이게 각도일까? 아니네 (All info: 얼굴과 몸의 상위 파라미터만 있음. tile, lean, position 등)
    //console.log("[allinfo]==========================");
    //console.log(allInfo);
    //printLog(allInfo);
    //===============================================

    if(getCMV('DEBUG_LANDMARK')){
        drawLandmark(PoI);
    }
    if(results.faceLandmarks){
        pushInfo(tmpInfo);
    }
    firstTime = false;
    setTimeout(function(){
        mlLoop();
    }, 100);
}

// the main ML loop
// 홀리스틕 모델 수행 코드
let mlLoopCounter = 0;
async function mlLoop(){
    let hModel = getHolisticModel();
    if(checkImage()){
        mlLoopCounter += 1;
        await hModel.send({image: getCameraFrame()});
    }else{
        setTimeout(function(){
            mlLoop();
        }, 500);
    }
}

// the main visualization loop
// 메인 그리기 함수
let viLoopCounter = 0;
async function viLoop(){
    let minVIDura = getCMV("MIN_VI_DURATION");
    let maxVIDura = getCMV("MAX_VI_DURATION");
    if(currentVrm && checkImage()){
        viLoopCounter += 1;
        currentVrm.update(clock.getDelta());

        //핵심 업데이트 함수 (캐릭터 머리, 몸의 위치를 업데이트 함)
        updateInfo();

        //단순 렌더러
        drawScene(scene);

        setTimeout(function(){
            requestAnimationFrame(viLoop);
        }, minVIDura);

    }else{
        setTimeout(function(){
            requestAnimationFrame(viLoop);
        }, maxVIDura);
    }
}

// mood check
let noMoods = [];
function resetVRMMood(){
    noMoods = [];
    Object.keys(moodMap).forEach(function(i){
        if(!(defaultMoodList.includes(i))){
            delete moodMap[i];
        }
    });
    if(currentVrm){
        let defaultMoodLength = defaultMoodList.length;
        let unknownMood = currentVrm.blendShapeProxy._unknownGroupNames;
        for(let newmood of unknownMood){
            let newmoodid = Object.keys(moodMap).length - defaultMoodLength + 1;
            if(!Object.values(moodMap).includes(newmood)){
                if(newmoodid <= getCMV("MOOD_EXTRA_LIMIT")){
                    moodMap[newmoodid.toString()] = newmood;
                }
            }
        }
    }
}
function checkVRMMood(mood){
    if(mood == "auto"){
        return true;
    }else if(noMoods.includes(mood)){
        return false;
    }else if(currentVrm){
        let tmood = moodMap[mood];
        if(currentVrm.blendShapeProxy.getBlendShapeTrackName(tmood)){
            return true;
        }else if(currentVrm.blendShapeProxy.getBlendShapeTrackName(mood)){
            return true;
        }else{
            noMoods.push(mood);
            return false;
        }
    }else{
        return false;
    }
}

// integration check
async function checkIntegrate(){
    drawLoading("⟳ Integration Validating...");
    let image = getCameraFrame();
    let hModel = getHolisticModel();
    await hModel.send({image: getCameraFrame()});
    
    requestAnimationFrame(viLoop);     //캐릭터 본의 위치를 업데이트 함 
    mlLoop();  //카메라로부터 오는 이미지를 홀리스틱에 넘김 
    
    console.log("ml & visual loops initialized");
}

// check VRM model
function checkVRMModel(){
    if(currentVrm){
        return true;
    }else{
        return false;
    }
}

// initialization loop
function initLoop(){
    if(window.mobileCheck()){
        drawMobile();
    }else{
        drawLoading("Initializing");
        if(checkVRMModel() && checkHModel() && checkImage()){
            console.log("start integration validation");
            checkIntegrate();
        }else{
            requestAnimationFrame(initLoop);
        }
    }
}

// validate counter
function prettyNumber(n){
    return Math.floor(n * 1000) / 1000;
}
function checkFPS(){
    console.log("FPS: ",
        prettyNumber(viLoopCounter / getCMV("FPS_RATE")),
        prettyNumber(mlLoopCounter / getCMV("FPS_RATE")));
    viLoopCounter = 0;
    mlLoopCounter = 0;
}
