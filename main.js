let APP_ID = "3d8920a0383f45ff95e21fe7704ad24b"

let token = null;
let uid = String(Math.floor(Math.random() * 100000));


let client;
let channel;

//extracts room id from the link
let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

//if there is no roomId then redirect to the lobby
if (!roomId) {
    window.location = 'lobby.html';
}

// own local video and audio stream
let localStream;
// remote/other device video and audio stream
let remoteStream;

let peerConnection;

// do not need to add stun servers in local environment
// but when in production stun servers must be there
const servers = {
    iceServers: [
        {
            urls:['stun:stun1.1.google.com:19302' , 'stun:stun2.1.google.com:19302']
        }
    ]
}


let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({ uid, token })
    //index.html?room=23432
    channel = client.createChannel(roomId);
    await channel.join();

    channel.on('MemberJoined', handleUserJoined);
    channel.on('MemberLeft', handleUserLeft);
    client.on('MessageFromPeer', handleMessageFromPeer);

    // this will get permission from user to access video and audio
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    // video tag has a property called srcObject
    document.getElementById('user-1').srcObject = localStream;
    
}
let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none';   
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);
    if (message.type === 'offer') {
         createAnswer(MemberId, message.offer);
    }
    if (message.type === 'answer') {
         addAnswer(message.answer);
    }
    if (message.type === 'candidate') {
        if (peerConnection) {
             peerConnection.addIceCandidate(message.candidate);
         }
    }

}
let handleUserJoined = async (MemberId) => { 
    console.log('User Joined', MemberId);
    createOffer(MemberId);
   
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        document.getElementById('user-1').srcObject = localStream;
    }
    //so remote stream can get the local stream 
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    });
    
    //to listen to remote track on the local env 
    peerConnection.ontrack = (event) => { 
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        })
    }

    peerConnection.onicecandidate = async  (event) => {
        if(event.candidate){
            client.sendMessageToPeer({ text: JSON.stringify({'type':'candidate','candidate':event.candidate}) }, MemberId);
        }
    }
}
let createOffer = async (MemberId) => {
    

    await createPeerConnection(MemberId);

    //take this offer and each ICE candidate and send it to the other peer
    // the peer will reply back and then connection will be there
    let offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({ text: JSON.stringify({'type':'offer','offer':offer}) }, MemberId);
} 

let createAnswer = async (MemberId,offer) => {
    await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({ text: JSON.stringify({'type':'answer','answer':answer}) }, MemberId);

}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) { 
        peerConnection.setRemoteDescription(answer);
}
}

let leaveChannel = async () => { 
    await channel.leave();
    await client.logout();
   
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    //camera off
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    //mic off
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)'
    }
    else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}


//user leaves when the window closed out 
window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();