var io = require('socket.io-client');
var should = require('should');

var server = require('../server.js');

//WebSocketのテスト
describe('server', function() {

    var socket;
    //webSocketテスト用の初期化処理
    beforeEach(function(done) {
        //Setup
        socket = io.connect('http://localhost:8080', {
            'reconection delay': 0,
            'reopen delay': 0,
            'force new connection': true
        });
        socket.on('connect', function() {
            console.log('テスト用のWebSocketに接続したよ');
            done();
        })
        socket.on('disconnect', function() {
            console.log('切断！');
        })
    })

    afterEach(function(done) {
        //Cleanup
        if (socket.connected) {
            console.log('WebSocket切断するね');
            socket.disconnect();
        }
        else {
            console.log('なんかもうWebSocketの接続が切れてるぽい');
        }
        done();
    });
    
    describe('test of test', function(){
        it('hahahahaha', function(done){
            true.should.equal(true);
            done();
        });
        
        it('bulabulabula', function(done){
            false.should.equal(false);
            done();
        });
    });
})