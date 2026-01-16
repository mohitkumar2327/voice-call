const socket = io("http://localhost:3001");

let roomId;
let localStream;
let peerConnection;
let isMuted = false;


const remoteAudio = document.getElementById("remoteAudio");
const statusText = document.getElementById("status");
const roomDisplay = document.getElementById("roomDisplay");
const joinInput = document.getElementById("joinInput");


const pcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

async function joinRoom() {
  roomId = joinInput.value.trim();

  if (!roomId) {
    alert("Enter a valid Room ID");
    return;
  }

  socket.emit("join-room", roomId);
  roomDisplay.innerText = roomId;
  statusText.innerText = "Status: Joined room. Waiting for call.";
}


function createRoom() {
  roomId = Math.random().toString(36).substring(2, 10);
  socket.emit("join-room", roomId);

  roomDisplay.innerText = roomId;
  statusText.innerText = "Status: Room created. Share this ID.";
}

function toggleMute() {
  if (!localStream) return;

  localStream.getAudioTracks()[0].enabled = isMuted;
  isMuted = !isMuted;

  statusText.innerText = isMuted ? "Status: Muted" : "Status: Unmuted";
}


async function startCall() {
  peerConnection = new RTCPeerConnection(pcConfig);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        candidate: event.candidate
      });
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", { roomId, offer });
}

socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection(pcConfig);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track =>
    peerConnection.addTrack(track, localStream)
  );

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        roomId,
        candidate: event.candidate
      });
    }
  };

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("ice-candidate", async (candidate) => {
  await peerConnection.addIceCandidate(candidate);
});

socket.on("user-joined", () => {
  statusText.innerText = "Status: User joined. Ready to call.";
});

socket.on("join-room", (roomId) => {
  socket.join(roomId);
  socket.to(roomId).emit("user-joined");
});


function endCall() {
  peerConnection.close();
  peerConnection = null;
}
