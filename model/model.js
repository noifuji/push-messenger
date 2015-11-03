/*
* モデル
*
*/

var mongoose = require('mongoose');
var db = mongoose.connect('mongodb://localhost/testDB');

function validator(v) {
    return v.length > 0;
}

var Users = new mongoose.Schema({
  id   : {
    type: Number
  },
  username   : {
    type: String, validate: [validator, "Empty Error"]
  },
  description : {
    type: String,
    default: ""
  },
  friends : {
    type: Array, //userの配列を格納
    default: []
  },
  thumbnail: {
    type: String,
    default: "unknown.png"
  },
  endpointids: {
    type: Array, //ユーザーがもつ端末それぞれのidを格納
    default: []
  }
});


var Rooms = new mongoose.Schema({
  roomid   : {
    type: String, validate: [validator, "Empty Error"]
  },
  participants   : {
    type: Array,
  },
  messages : {
    type: Array, //messageの配列を格納
    default: []
  }
});


exports.Users = db.model('Users', Users);
exports.Rooms = db.model('Rooms', Rooms);