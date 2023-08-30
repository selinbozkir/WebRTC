let init = async () => {
    client = await AgoraRTM.createInstance(app_id);
    await client.login({ uid, token });
    channel = client.createChannel(roomId);
    await channel.join();
    channel.on('MemberJoined', handleUserJoined);
    channel.on('MemberLeft', handleUserLeft);
    client.on('MessageFromPeer', handleMessageFromPeer);
    localStream = await navigator.mediaDevices.getUserMedia(contraints);
    document.getElementById('kullanici1').srcObject = localStream;
}

//WebRTC bağlantısı oluşturma 
let createPeerConnection = async () => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById("kullanici2").srcObject = remoteStream;
    document.getElementById("kullanici2").style.display = "block";
    document.getElementById('kullanici1').style.width = '100%';
    document.getElementById('kullanici1').style.height = '100%';


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        document.getElementById('kullanici1').srcObject = localStream
    }


    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }

}

//Oluşturulan WebRTC bağlantısı üzerinde bir teklif oluşturur 

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId)
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    client.sendMessageToPeer(
        {
            text: JSON.stringify({ 'type': 'offer', 'offer': offer })
        }
        , MemberId
    )

}

//Teklif üzerine cevap oluşturarak oluşturarak WebRTC bağlantısı kurar ve oluşturulan cevabı belirtilen MemberID'ye gönderir.

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
}