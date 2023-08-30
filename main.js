let app_id = "d3eeebc6d7cc45a38e65d9a68f4edb09";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

/*mevcut url'nin sorgu dizisini alır, "?" işaretinden sonra gelen
parametreleri içerir*/
let queryString = window.location.search;

/* sorgu parametreleriyle işlem yapmak için kullanıyoruz */
let urlParams = new URLSearchParams(queryString);

/* room parametresine karşılık gelen değeri döndürür mesela 
url 'example.com?room=123' olsun bu roomId değeri 123 olur */
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = "lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

/*RTCPeerConnection yapılandırmasını belirli bir STUN sunucusuyla yapılandırmak
için kullanılır. 
iceServers: sunucu yapılandırılmasını belirtir 
ICE: iki cihaz arasında doğrudan bağlantı kurmayı mümkün kılan protokoldür. 
STUN: cihazın gerçek IP adresii ve port numarasını belirlemek için kullanılır.*/
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

//videoların boyutuyla ilgili kısıtlamalar
let contraints = {
    video: {
        width: { min: 640, ideal: 1920, max: 1920 },
        height: { min: 480, ideal: 1080, max: 1080 },
    },
    audio: true
}

/*AgoraRTM: Canlı sohbet, sosyal ağlar, oyunlar, işbirliği uygulamarı ve 
diğer gerçek zamanlı iletişim senaryolarında kullanılabilir. */

let init = async () => {

    /*bir AgoraRTM oluşturuyoruz appid'miz agora'daki uygulama kimliğini
    temsil ediyor */
    client = await AgoraRTM.createInstance(app_id);

    //agora için oturum açma 
    await client.login({ uid, token });

    //roomid ile kanal oluşturma 
    channel = client.createChannel(roomId);

    //oluşturulan odaya katılma izni 
    await channel.join();

    //bir üye odaya katıldığında tetiklenir 
    channel.on('MemberJoined', handleUserJoined);

    //bir üye odadan ayrıldığında tetiklenir 
    channel.on('MemberLeft', handleUserLeft);

    //kullanıcıdan gelen mesajlar için kullanılır
    client.on('MessageFromPeer', handleMessageFromPeer);

    /* Kamera, mikrofon gibi medya cihazlarına erişim sağlar ve girilen 
    contraints parametresiyle de kısıt getirilir*/

    localStream = await navigator.mediaDevices.getUserMedia(contraints);

    //yerel medya akışının html'de görüntülenmesini sağlar
    document.getElementById('kullanici1').srcObject = localStream;
}

let handleUserJoined = async (MemberId) => {
    createOffer(MemberId);
}

let handleUserLeft = (MemberId) => {
    document.getElementById("kullanici2").style.display = 'none';
    document.getElementById('kullanici1').style.width = '100%';
    document.getElementById('kullanici1').style.height = '100%';
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        createAnswer(MemberId, message.offer);
    }

    if (message.type === 'answer') {
        addAnswer(message.answer);

    }
    if (message.type === "candidate") {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

//WebRTC teklifi(offer) oluşturur ve iletimini sağlar 
let createPeerConnection = async () => {

    //WebRTC araciliği ile gerçek zamanlı iletişim sağlamak için kullanılır. 
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream(); //uzaktaki kullanıcı akışı 

    /* kullanici2'ye srcObject ile remoteStream'i atar. remoteStream'i 
    içeren medya görüntülenebilir hale gelir. Bu uzaktaki kullanıcının 
    görüntüsünün bu HTML ögesinde görüntülenmesini sağlar.*/
    document.getElementById("kullanici2").srcObject = remoteStream;
    document.getElementById("kullanici2").style.display = "block";
    document.getElementById('kullanici1').style.width = '100%';
    document.getElementById('kullanici1').style.height = '100%';


    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        document.getElementById('kullanici1').srcObject = localStream
    }

    /*
    
    - getTrack(), MediaStream nesnesinin yöntemi ve belirtilen bir parça 
    (track) türünü almak için kullanılır. Bu yöntem, medya akışında 
    bulunan ses veya video parçalarını elde etmek için kullanılır.

    - addTrack(), medya akışına yeni parça eklemek için kullanılır.
    
    */

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    /*onTrack: Yeni bir track eklendiğinde tetiklenen bir olayı işlemek için
   kullanılır. Genellikle uzaktaki bir kullanıcının medya akışına alındığı 
   zaman gerçekleşir.  */
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }
    /*onicecandidate: olayı, her bir ICE adayı oluşturulduğunda tetiklenir. 
    Bu adaylar, tarayıcının kendi ağ bağlantı bilgilerini içerir. 
    Olay işleyicisi fonksiyonu, her bir ICE adayının yakalanması ve işlenmesi için kullanılır. */
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
        }
    }


}

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId)
    /* createOffer yöntemi local cihazın özelliklerine dayanarak
     bir WebRTC teklifi oluşturur. */
    let offer = await peerConnection.createOffer();

    /*'offer' teklifi yerel bir tanımlama olarak ayarlanır. Bu, 
    yerel cihazın teklifi uzaktaki kullanıcıya göndermek için kullanılacağı 
    anlamına gelir.*/
    await peerConnection.setLocalDescription(offer);

    //kısaca offer-answer modeli kullanarak bağlantı başlatıyoruz
    //teklif karşı tarafa iletiliyor, teklife gelen yanıt karşı 
    //tarafın yerel açıklaması olarak ayarlanıyor böylece iki taraf arasında
    //medya ve veri bağlantısı oluşuyor 
    //oluşturulan teklif mesajı karşı tarafa (memberid) 
    //json formatında iletiliyor

    client.sendMessageToPeer(
        {
            text: JSON.stringify({ 'type': 'offer', 'offer': offer })
        }
        , MemberId
    )

}


let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
}

let addAnswer = async (answer) => {
    //mevcut uzak tanımlamanın olup olmadığını kontrol ediyor
    if (!peerConnection.currentRemoteDescription) {
        /*
          answer yanıtını uzak tanımlama olarak ayarlar. 
          Bu, bağlantıyla ilişkili uzak bir açıklama haline gelir ve 
          bağlantının kurulması için gerekli bilgileri içerir.
        */
        peerConnection.setRemoteDescription(answer)
    }
}


let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}



let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-buton').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-buton').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-buton').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mic-buton').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

/*
Bu kod bloğu, tarayıcı penceresi kapatılmadan önce (unload öncesi) 
leaveChannel adlı bir işlevin tetiklenmesini sağlar.
window.addEventListener() yöntemi, belirtilen olayın tarayıcı penceresinde
dinlenmesini sağlar.
*/
window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-buton').addEventListener('click', toggleCamera)
document.getElementById('mic-buton').addEventListener('click', toggleMic)

init() 