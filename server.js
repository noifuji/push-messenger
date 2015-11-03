//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

//モデルの定義
var model = require('./model/model.js');
var Users = model.Users;
var Rooms = model.Rooms;

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));

//クライアントのソケットを保持する配列
var sockets = [];
var endpoints = [];


//Socket IO
io.on('connection', function(socket) {

    sockets.push(socket);

    //切断
    socket.on('disconnect', function() {
        sockets.splice(sockets.indexOf(socket), 1);
    });

    //ルーム退出
    socket.on('leave_room', function(roomid, done) {
        socket.leave(roomid);
        console.log("leave room of " + roomid);
        done();
    });

    //ルーム入室
    socket.on('join_room', function(join_request, done) {
        //ルーム入室
        socket.join(join_request.roomid);
        console.log("join room of " + join_request.roomid)

        //ルーム検索 (メッセージの履歴取得)
        Rooms.find({
            roomid: join_request.roomid
        }, function(err, rooms) {
            //ルーム検索エラー
            if (err) {
                console.log(err);
                done(null);
                return;
            }
            //ルーム検索成功
            else if (rooms.length == 1) {
                console.log("fetch previous messages of the room " + join_request.roomid)
                done(rooms[0].messages);
            }
            //ルーム検索されない
            else if (rooms.length == 0) {
                console.log("create new room " + join_request.roomid)
                //新規ルームを作成する
                var room = new Rooms({
                    roomid: join_request.roomid,
                    participants: join_request.participants
                });
                room.save();
                //メッセージは空
                done(room.messages);
            }
            //ルーム検索異常
            else {
                console.log("There seems to be 2 or more rooms whose roomid is : " + join_request + " in the db.");
                done(null);
                return;
            }

        });
    });

    //メッセージ取得
    socket.on('send_message', function(msg) {

        //メッセージがない
        if (!String(msg.text || '')) {
            console.log(msg.text);
            return;
        }

        if (!msg.text) {
            console.log(msg.text);
            return;
        }

        //console.log(msg.text);
        //console.log(socket.id);

        //同じ部屋のメンバにメッセージを送信
        io.to(msg.roomid).emit('multicast', msg);

        //該当するルームの履歴を探し、DBを更新する。
        Rooms.find({
            roomid: msg.roomid
        }, function(err, rooms) {
            if (err) {
                console.log(err);
                return;
            }

            var msgs = rooms[0].messages;
            msgs.push(msg);
            Rooms.update({
                roomid: msg.roomid
            }, {
                messages: msgs
            }, {
                upsert: true
            }, function(err) {
                if (err) {
                    console.log(err);
                    return;
                }
            });

            //ルームの参加者から通知先のendpointidを取得する。
            Users.find({
                'id': {
                    $in: rooms[0].participants
                }
            }, function(err, participants) {
                if (err) {
                    console.log(err);
                    return;
                }

                var pushEndpoints = [];
                participants.forEach(function(user) {
                    if (msg.userid != user.id) { //自分には通知を送らない
                        user.endpointids.forEach(function(endpointid) {
                            pushEndpoints.push(endpointid);
                        });
                    }
                });

                //通知
                pushNotification(pushEndpoints);
            });
        });

    });

    //エンドポイント(ブラウザ固有のIDのこと？)登録処理
    socket.on('register_endpoint', function(req) {
        //idに一致するユーザーを検索
        Users.find({
            'id': req.userid
        }, function(err, users) {
            if (err) {
                console.log(err);
                return;
            }
            var endpointids = users[0].endpointids;
            endpointids.push(req.endpoint);
            endpointids = endpointids.filter(function(x, i, self) {
                return self.indexOf(x) === i;
            });
            Users.update({
                id: req.userid
            }, {
                endpointids: endpointids
            }, {
                upsert: true
            }, function(err) {
                if (err) {
                    console.log(err);
                    return;
                }
            });
        });
    });

    //エンドポイント削除
    socket.on('delete_endpoint', function(endpoint) {
        for (var i = 0; i < endpoints.length; i++) {
            if (endpoints[i] == endpoint) {
                endpoints.splice(i, 1);
            }
        }
        console.log("endpoints length:" + endpoints.length);
    });

    //ログイン
    socket.on('login', function(username, fn) {
        //Usernameが一致するユーザーを検索する。
        Users.find({
            'username': username
        }, function(err, users) {
            if (err) {
                console.log(err);
                fn(null);
                return;
            }

            if (users.length != 1) {
                fn(null);
                return;
            }

            var user = users[0];

            //friendsにはidしか入っていない。フレンドのユーザーidから情報を検索する。
            /*Users.find({
              'id': {
                $in: user.friends
              }
            }, function(err, friends) {
              if (err) {
                console.log(err);
                fn(null);
                return;
              }

              //具体的な情報をつめてクライアントへ返す。
              user.friends = friends;
              fn(user);
            });*/

            //@一時的に全ユーザーをし返す
            Users.find(function(err, friends) {
                if (err) {
                    console.log(err);
                    fn(null);
                    return;
                }

                //具体的な情報をつめてクライアントへ返す。
                user.friends = friends;
                fn(user);
            });
        });
    });

    //登録
    socket.on('signup', function(req, fn) {
        Users.find({
            'username': req.username
        }, function(err, users) {
            if (err) {
                console.log(err);
                fn(null);
                return;
            }

            //ユーザー名がかぶってたらだめ
            if (users.length > 0) {
                fn(null);
                return;
            }

            Users.findOne({
                $query: {},
                $orderby: {
                    id: -1
                }
            }, function(err, user) {
                var newUser = new Users();
                newUser.id = (user ? user.id + 1 : 1);
                newUser.username = req.username;
                newUser.description = "new User";
                newUser.friends = [];
                newUser.thumbnail = "unknown.png";
                newUser.endpointids = [];
                newUser.save(function(err, user) {
                    if (err != null) {
                        console.log(err);
                    }
                    fn(user);
                });
            });
        });
    });

    socket.on('test', function(req, fn) {
        io.to("1234").emit('test_msg_rec', req);
    });
    socket.on('test_join', function(req, fn) {
        socket.join(req);
    });
});

//消していい
function broadcast(event, data) {
    console.log(sockets.length);
    sockets.forEach(function(socket) {
        socket.emit(event, data);
    });
}

//Sends notification request to GCM server.
function pushNotification(endpoints) {
    var https = require('https');

    var headers = {
        'Authorization': 'key=AIzaSyDDgYaIYetAHiJIoF_egwBJwGFSQgw29VI',
        'Content-Type': 'application/json'
    };

    var jsonData = {
        "registration_ids": endpoints
    };

    var options = {
        host: 'android.googleapis.com',
        port: 443,
        path: '/gcm/send',
        method: 'POST',
        headers: headers
    };

    var req = https.request(options, function(res) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            console.log('BODY: ' + chunk);
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });

    req.write(JSON.stringify(jsonData));
    console.log(req);
    req.end();
}

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function() {
    var addr = server.address();
    console.log("Chat server listening at", addr.address + ":" + addr.port);
});