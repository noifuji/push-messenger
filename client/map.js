var ws; // webSocketオブジェクト
var roommates = ""; // 部屋の接続人数
var room_id = ""; // 部屋ID
var mapMode = "draw"; // googleMapsのモード
var content; // 吹き出しの中身
var myInfoWindow; // 吹き出しのオブジェクト
var lockFlagZoom = false; // アンロック状態
var lockFlagMove = false;
var gDrawFlag = false; //アンロック状態
var mouseDownFlag = false;
var distance = 0;
var prevX = 0;
var prevY = 0;
var wsTmpLat = null;
var wsTmpLng = null;
var markerLat = null;
var markerLng = null;
var previousLatLng = null;
var windowEdgeMargin = 40;
var panPixel = 100;
var overLayArray = [];

// 画面端判定
function isWithinMapEdgeMargin(x, y) {
    if (x > windowEdgeMargin && x < $("#map").width() - windowEdgeMargin && y > windowEdgeMargin && y < $("#map").height() - windowEdgeMargin) {
        return false;
    }
    else {
        return true;
    }
}

function whichEdgeMargin(x, y){
	if(x < windowEdgeMargin){
		if(y < windowEdgeMargin){
			return "NW";
		}else if(y < ($("#map").height() - windowEdgeMargin)){
			return "W";
		}else{
			return "SW";
		}
	}else if(x >= windowEdgeMargin && x < ($("#map").width() - windowEdgeMargin)){
			if(y < windowEdgeMargin){
				return "N";
			}else if(y >= $("#map").height() -windowEdgeMargin){
				return "S";
			}
		}else if(x > $("#map").width()-windowEdgeMargin){
			if(y < windowEdgeMargin){
				return "NE";
			}else if(y >= windowEdgeMargin && y < $("#map").height() - windowEdgeMargin){
				return "E";
			}else if(y >= $("#map").height() - windowEdgeMargin){
				return "SE";
			}

		}
}


// ページロード時に呼び出される関数
$(function() {

    /***************************************************
     * Googleマップの生成
     */
    var map = new GMaps({
        div: '#map',
        zoom: 17,
        lat: 34.985458,
        lng: 135.757755,
        disableDefaultUI: true
    });

    var opts = {
        draggable: false
    };
    map.setOptions(opts);

    var socket = io.connect();
    socket.emit('test_join', "1234");
    socket.on('test_msg_rec', function(message) {
        // WebSocketから通信が来たときに呼び出される関数
        // メッセージの種類の識別を行う
        var msgType = message.substring(0, message.indexOf(":"));
        var data = message.substring(message.indexOf(":") + 1);

        // メッセージの種類に応じた処理
        switch (msgType) {
            case "GDRAW":
                gDrawFlag = true; //まずロックする
                var lat = data.substring(0, data
                    .indexOf(","));
                var lng = data
                    .substring(data.indexOf(",") + 1);
                if (lat != null && lng != null && this.wsTmpLat != null && this.wsTmpLng != null) {
                    // document.getElementById("chatlog").textContent
                    // += lat
                    // + "\n" + lng + "\n";

                    var from = new google.maps.LatLng(
                        parseFloat(this.wsTmpLat),
                        parseFloat(this.wsTmpLng));
                    var to = new google.maps.LatLng(
                        parseFloat(lat),
                        parseFloat(lng));

                    var linePath = [from, to];
                    // Polyline オブジェクト
                    ln = new google.maps.Polyline({
                        path: linePath, // ポリラインの配列
                        strokeColor: '#136FFF', // 色（#RRGGBB形式）
                        strokeOpacity: 0.7, // 透明度
                        // 0.0～1.0（デフォルト）
                        strokeWeight: 2.5, // 太さ（単位ピクセル）
                        clickable: false
                    });

                    ln.setMap(map.map);
                    overLayArray[overLayArray.length] = ln;
                    distance += google.maps.geometry.spherical.computeDistanceBetween(from, to);
                }
                // document.getElementById("chatMessage").textContent
                // += this.wsTmpLat
                // + "\n";
                this.wsTmpLat = lat;
                this.wsTmpLng = lng;
                break;
            case "ODRAW":
                var splitResult = data.split(",");
                var x = parseFloat(splitResult[0]);
                var y = parseFloat(splitResult[1]);
                var dx = parseFloat(splitResult[2]);
                var dy = parseFloat(splitResult[3]);
                // document.getElementById("chatlog").textContent
                // += "結果:"+ x+y+dx+dy+"\n";
                var canvas = $('#original-map-canvas').get(
                    0);
                var ctx = canvas.getContext('2d');
                ctx.strokeStyle = '#136fff';
                ctx.lineWidth = 5;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(x - dx, y - dy);
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.closePath();
                break;
            case "OMOVE":
                var splitResult = data.split(",");
                var dx = parseFloat(splitResult[0]) / 5;
                var dy = parseFloat(splitResult[1]) / 5;
                $("#original-map-canvas").animate({
                    'left': '-=' + dx,
                    'top': '-=' + dy
                }, 0);
                break;
            case "END":
                this.wsTmpLat = null;
                this.wsTmpLng = null;
                //document.getElementById("chatlog").textContent += "距離:"
                //		+ Math.round(distance)
                //		+ "m"
                //		+ "\n";
                distance = 0;
                gDrawFlag = false; //ロック解除する

                break;
            case "ZOOM":
                if (lockFlagZoom == false) {
                    lockFlagZoom = true;
                }
                console.log(lockFlagZoom);
                if (map.map.getZoom() != parseInt(data)) {
                    map.map.setZoom(parseInt(data));

                }
                lockFlagZoom = false; // ロックを解除する
                break;

            case "MOVE":
                if (lockFlagMove == false) {
                    lockFlagMove = true;
                }
                var lat = parseFloat(data.substring(0, data
                    .indexOf(",")));
                var lng = parseFloat(data.substring(data
                    .indexOf(",") + 1));
                if ((map.map.getCenter().lat() != lat || map.map
                        .getCenter().lng() != lng) && (lat != null || lng != null)) {
                    map.map.panTo(new google.maps.LatLng(
                        lat, lng));
                }
                lockFlagMove = false;
                break;
                /*
                								case "pMOVE":
                									if (lockFlagMove == false) {
                										lockFlagMove = true;
                									}
                									var x = parseFloat(data.substring(0, data
                											.indexOf(",")));
                									var y = parseFloat(data.substring(data
                											.indexOf(",") + 1));

                									map.map.panBy(x, y);

                									lockFlagMove = false;
                									break;
                */
            case "MARK":
                var lat = parseFloat(data.substring(0, data
                    .indexOf(",")));
                var lng = parseFloat(data.substring(data
                    .indexOf(",") + 1));

                var marker = map.addMarker({
                    lat: lat,
                    lng: lng,
                    title: '現在地',
                    animation: google.maps.Animation.DROP,
                    click: function(e) {
                        // alert('You clicked in this
                        // marker');
                    }
                });

                overLayArray[overLayArray.length] = marker;
                break;

            case "DMARK":
                var lat = parseFloat(data.substring(0, data
                    .indexOf(",")));
                var lng = parseFloat(data.substring(data
                    .indexOf(",") + 1));
                var hogeResult = data.split(",");
                var hoge = hogeResult[2];

                // 吹き出しの中身
                var content = '<div style="width:200px;height:150px">' + hoge + '</div>';

                var marker = map.addMarker({
                    lat: lat,
                    lng: lng,
                    animation: google.maps.Animation.DROP,
                    draggable: true,
                    infoWindow: {
                        content: content
                    }
                });

                overLayArray[overLayArray.length] = marker;

                google.maps.event.trigger(marker, "click");

                break;
            case "CIRCLE":
                var lat = parseFloat(data.substring(0, data
                    .indexOf(",")));
                var lng = parseFloat(data.substring(data
                    .indexOf(",") + 1));
                var circle = map.drawCircle({
                    lat: lat,
                    lng: lng,
                    radius: 10,
                    fillColor: "#FFFF00",
                    fillOpacity: 1.0,
                    strokeColor: "#000000",
                    strokeOpacity: 1.0,
                    draggable: true
                });

                google.maps.event.addListener(circle, 'mouseup',
                    function() {
                        if (mouseDownFlag == true) {
                            console.log("mouseup");
                            google.maps.event.trigger(map.map, 'mouseup');
                        }
                    });

                overLayArray[overLayArray.length] = circle;

                break;
            case "MOUSEDOWN":
                gDrawFlag = true; //まずロックする
                break;
            case "RESIZE":
                latlng = data.split(',');
                setRect(new google.maps.LatLng(latlng[0], latlng[1]), new google.maps.LatLng(latlng[2], latlng[3]));
            default:
                break;
        }

    });

    /***************************************************
     * クリックでマーカーを設置
     */
    google.maps.event.addListener(map.map, 'click',
        function(e) {
            if (mapMode == "mark") {
                markerLat = e.latLng.lat();
                markerLng = e.latLng.lng();
                $("#marker_popup").popup();
                $("#marker_popup").popup("open");
            }
            else if (mapMode == "draw") {
                if (mouseDownFlag != true) {
                    var point = e.pixel;
                    if (isWithinMapEdgeMargin(point.x, point.y)) {
                        //方角へ進んで、MOVEで共有
                        switch (whichEdgeMargin(point.x, point.y)) {
                            case "NW":
                                map.map.panBy(-1 * panPixel, -1 * panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "W":
                                map.map.panBy(-1 * panPixel, 0);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "SW":
                                map.map.panBy(-1 * panPixel, panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "N":
                                map.map.panBy(0, -1 * panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "S":
                                map.map.panBy(0, panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "NE":
                                map.map.panBy(panPixel, -1 * panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "E":
                                map.map.panBy(panPixel, 0);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;
                            case "SE":
                                map.map.panBy(panPixel, panPixel);
                                var centerLatLng = map.map.getCenter();
                                socket.emit("test", "MOVE:" + centerLatLng.lat() + "," + centerLatLng.lng());
                                break;

                        }




                    }
                }
            }


        });

    /***************************************************
     * 描画の処理
     */
    // 一時的な座標情報
    // var tmpLat = 35.658613;
    // var tmpLng = 139.745525;
    // var ln = null;
    // マウスが動いたら処理
    google.maps.event.addListener(map.map, 'mousemove',
        function(e) {

            switch (mapMode) {
                case "draw": // 描画モードの処理
                    // ドラッグ中ならば描画する

                    if (mouseDownFlag == true) {

                        // サーバーに送信
                        var msg = e.latLng.lat() + "," + e.latLng.lng();
                        socket.emit('test', "GDRAW:" + msg);

                    }
                    else if (mouseDownFlag == false) { // ドラッグ中でなければ何もしない
                        // document.getElementById("latLng").textContent
                        // +=
                        // "false" + "\n";
                    }
                    else {
                        alert("error");
                    }

                    break;
                case "move": // 移動モードの処理
                    break;
            }

        });

    // マウスが押されたときの処理
    google.maps.event.addListener(map.map, 'mousedown',
        function(e) {
            socket.emit('test', "MOUSEDOWN:"); //マウスダウンを送信
            if (gDrawFlag == false) { //アンロック状態ならマウスダウンを通す
                if (mouseDownFlag == false) {
                    // 線を描画可能状態にする
                    mouseDownFlag = true;
                    // 線の初期位置を設定する
                    tmpLat = e.latLng.lat();
                    tmpLng = e.latLng.lng();

                }
            }
        });

    // マウスがはなされたときの処理
    google.maps.event.addListener(map.map, 'mouseup',
        function(e) {
            //console.log("mouseup_map.map");
            // ENDメッセージを送信
            socket.emit('test', "END:");
            // 線を描画不可状態にする
            mouseDownFlag = false;

            //マージン以外なら丸を表示する
            var point = e.pixel;
            if (mapMode == "draw" && distance == 0 && !isWithinMapEdgeMargin(point.x, point.y)) {
                socket.emit("test", "CIRCLE:" + e.latLng.lat() + "," + e.latLng.lng());
            }
        });

    google.maps.event
        .addListener(
            map.map,
            'zoom_changed',
            function() {
                if (lockFlagZoom == false) { // アンロック状態ならイベントをうける
                    lockFlagZoom = true;
                    socket.emit('test', "ZOOM:" + map.map
                        .getZoom());
                }
            });

    google.maps.event.addListener(map.map, 'dragend',
        function() {
            if (lockFlagMove == false) {
                lockFlagMove = true;
                var center = map.map.getCenter();
                var lat = center.lat();
                var lng = center.lng();
                socket.emit('test', "MOVE:" + lat + "," + lng);
            }
        });
});