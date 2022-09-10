const TVRMSHBN = THREE.VRMSchema.HumanoidBoneName;

let loader = new THREE.GLTFLoader();

let defaultPose = [
    [TVRMSHBN.LeftUpperArm, [0, 0, 70]],
    [TVRMSHBN.RightUpperArm, [0, 0, -70]],
    [TVRMSHBN.LeftLowerArm, [-20, -30, 10]],
    [TVRMSHBN.RightLowerArm, [-20, 30, -10]],
    [TVRMSHBN.LeftHand, [0, 0, 0]],
    [TVRMSHBN.RightHand, [0, 0, 0]]
];

//기본 위치 잡는 함수
function setDefaultPose(vrm){
    for(let i = 0; i < defaultPose.length; i ++){
        let pose = defaultPose[i];
        for(let j = 0; j < 3; j ++){
            vrm.humanoid.getBoneNode(pose[0]).rotation["xyz"[j]] = pose[1][j] / 180 * Math.PI;
        }
    }
}

//기본 손 위치 잡는 함수
function setDefaultHand(vrm, leftright){
    for(let i = leftright; i < defaultPose.length; i += 2){
        let pose = defaultPose[i];
        for(let j = 0; j < 3; j ++){
            vrm.humanoid.getBoneNode(pose[0]).rotation["xyz"[j]] = pose[1][j] / 180 * Math.PI;
        }
    }
}


//VRM 모델을 위치 정보로 변환하는 함수
function loadVRMModel(url, cb) {
    loader.crossOrigin = 'anonymous';
    loader.load(url,
        (gltf) => {
            THREE.VRMUtils.removeUnnecessaryVertices(gltf.scene);
            THREE.VRMUtils.removeUnnecessaryJoints(gltf.scene);
            THREE.VRM.from(gltf).then((vrm) => {
                setDefaultPose(vrm);
                cb(vrm);
            });
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => console.error(error)
    );
}