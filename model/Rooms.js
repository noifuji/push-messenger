/*
*  ルームの情報を格納するモデル
*
*/

var mongoose = require('mongoose');
var db = mongoose.connect('mongodb://localhost/testDB');

function validator(v) {
    return v.length > 0;
}

