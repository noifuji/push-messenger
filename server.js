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
var sockets = [];
var endpoints = [];

io.on('connection', function(socket) {

  sockets.push(socket);

  socket.on('disconnect', function() {
    sockets.splice(sockets.indexOf(socket), 1);
  });

  socket.on('leave_room', function(roomid, fn) {
    socket.leave(roomid);
    console.log("leave " + roomid)

  });

  socket.on('join_room', function(req, fn) {
    //ルーム入室
    socket.join(req.roomid);
    console.log("join " + req.roomid)

    //トークの履歴を取得
    Rooms.find({
      roomid: req.roomid
    }, function(err, rooms) {
      if (err) {
        console.log(err);
        fn(null);
        return;
      }

      if (rooms.length == 1) {
        fn(rooms[0].messages);
      }
      else if (rooms.length == 0) {
        //新規にルームを作成
        var room = new Rooms();
        room.roomid = req.roomid
        room.participants = req.participants;
        room.messages = [];
        room.save();
        fn([]);
      }

    });
  });

  socket.on('message', function(msg) {
    var text = String(msg.text || '');


    if (!text) {
      return;
    }

    var data = {
      "userid": msg.userid,
      "text": text
    };

    console.log(text);
    console.log(socket.id);

    io.to(msg.roomid).emit('message', data);

    //該当するルームの履歴を探し、DBを更新する。
    Rooms.find({
      roomid: msg.roomid
    }, function(err, rooms) {
      if (err) {
        console.log(err);
        return;
      }

      var msgs = rooms[0].messages;
      msgs.push(data);
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
          if (msg.userid != user.id) {//自分には通知を送らない
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

  socket.on('register_endpoint', function(req) {
    //idに一致するユーザーを検索。
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

  socket.on('delete_endpoint', function(endpoint) {
    for (var i = 0; i < endpoints.length; i++) {
      if (endpoints[i] == endpoint) {
        endpoints.splice(i, 1);
      }
    }
    console.log("endpoints length:" + endpoints.length);
  });


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
        if(users.length > 0) {
          fn(null);
          return;
        }
        
        Users.findOne({$query:{},$orderby:{id:-1}}, function(err, user) {
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

});

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