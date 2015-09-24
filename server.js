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

var model = require('./model/model.js');
var Users = model.Users;
var Rooms = model.Rooms;

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));
var messages = [];
var sockets = [];
var endpoints = [];

io.on('connection', function(socket) {
  messages.forEach(function(data) {
    socket.emit('message', data);

  });

  sockets.push(socket);

  socket.on('disconnect', function() {
    sockets.splice(sockets.indexOf(socket), 1);
    //updateRoster();
  });

  socket.on('get_histry_messages', function(roomid, fn) {
    Rooms.find({roomid : roomid}, function(err, rooms) {
      if (err) {
        console.log(err);
        fn(null);
        return;
      }
      
      if(rooms.length == 1) {
        fn(rooms[0].messages);
      } else if(rooms.length == 0) {
        //新規にルームを作成
        var room = new Rooms();
        room.roomid = roomid
        room.participants = [];
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

    //全体送信しているのを、個別にそうしんできるようにする。
    broadcast('message', data);
    
    //該当するルームの履歴を探し、DBを更新する。
    Rooms.find({roomid : msg.roomid}, function(err, rooms) {
      if (err) {
        console.log(err);
        return;
      }
      
      var msgs = rooms[0].messages;
      msgs.push(data);
      Rooms.update({roomid : msg.roomid},{messages:msgs}, {upsert: true}, function(err) {
      if (err) {
        console.log(err);
        return;
      }
    });
      
    });

    //Notifys a new message to all participants.　うっとうしいのでいったんとめます!!
    //pushNotification();
  });

/*  socket.on('identify', function(name) {
    socket.set('name', String(name || 'Anonymous'), function(err) {
      updateRoster();
    });
  });*/

  //button pushed @should be deleted
  socket.on('request', function() {
    pushNotification();
  });

  socket.on('register_endpoint', function(endpoint) {
    endpoints.push(endpoint);
    endpoints = endpoints.filter(function(x, i, self) {
      return self.indexOf(x) === i;
    });
  });

  socket.on('delete_endpoint', function(endpoint) {
    for (var i = 0; i < endpoints.length; i++) {
      if (endpoints[i] == endpoint) {
        endpoints.splice(i, 1);
      }
    }
  });

  //Fix it!
  socket.on('login', function(username, fn) {
    //Usernameが一致するユーザーを検索する。
    Users.find({'username': username}, function(err, users) {
      if (err) {
        console.log(err);
        fn(null);
        return;
      }
      
      if(users.length != 1) {
        fn(null);
        return;
      }
      
      var user = users[0];
      
      //friendsにはidしか入っていない。フレンドのユーザーidから情報を検索する。
      Users.find( { 'id':{$in:user.friends}}, function(err, friends) {
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

});

/*function updateRoster() {
  async.map(
    sockets,
    function(socket, callback) {
      socket.get('name', callback);
    },
    function(err, names) {
      broadcast('roster', names);
    }
  );
}*/

function broadcast(event, data) {
  console.log(sockets.length);
  sockets.forEach(function(socket) {
    socket.emit(event, data);
  });
}

//Sends notification request to GCM server.
function pushNotification() {
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
