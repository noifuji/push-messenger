var messenger = ons.bootstrap('messenger', ['onsen']);

messenger.factory('socket', function($rootScope) {
    var socket = io.connect();
    return {
        on: function(eventName, callback) {
            socket.on(eventName, function() {
                var args = arguments;
                $rootScope.$apply(function() {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function(eventName, data, callback) {
            socket.emit(eventName, data, function() {
                var args = arguments;
                $rootScope.$apply(function() {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        },
        removeAllListeners: function(eventName, callback) {
            socket.removeAllListeners(eventName);
            }
        }
    });

messenger.factory('userData', function($rootScope) {
    return {
        id: 0,
        username: "",
        description: "",
        friends: [],
        thumbnail: ""
    };
});

messenger.factory('talkData', function($rootScope) {
    return {
        roomid: "",
        messages: [],
        participants: []
    };
});

messenger.directive('onFinishRender', function($timeout) {
    return {
        restrict: 'A',
        link: function(scope, element, attr) {
            if (scope.$last === true) {
                $timeout(function() {
                    scope.$emit('ngRepeatFinished');
                });
            }
        }
    }
});

messenger.controller('LoginController', function($scope, socket, userData, talkData) {

    var timeoutId = null;
    $scope.userData = userData;
    $scope.username = "ryoma";

    socket.on('connect', function() {
        console.log("socket is connected");
    });
    
    socket.on('test', function(items) {
        console.log(items);
    });

    $scope.login = function login() {
        $scope.showModal();
        console.log('Sending username:' + $scope.username);
        socket.emit('login', $scope.username, function(result) {
            console.log(result);

            $scope.modal.hide();
            if (result) {
                $scope.userData.id = result.id;
                $scope.userData.username = result.username;
                $scope.userData.description = result.description;
                $scope.userData.friends = result.friends;
                $scope.myNavigator.pushPage('page1.html', {
                    animation: 'slide'
                });
                clearTimeout(timeoutId);
            }
            else {
                clearTimeout(timeoutId);
                alert("Failed to login.");
            }

        });
    };

    $scope.showModal = function showModal() {
        $scope.modal.show();
        timeoutId = setTimeout(function() {
            $scope.modal.hide();
            alert("Timed out");
        }, 6000);
    }
});


messenger.controller('FreindListController', function($scope, socket, userData, talkData) {
    console.log("FreindListController is loaded");
    $scope.userData = userData;
    $scope.talkData = talkData;

    $scope.moveToTalkPage = function(index) {
        var selectedItem = $scope.userData.friends[index];
        $scope.talkData.roomid = generateRoomId([selectedItem.id, userData.id]);
        
        //履歴を取得する。
        socket.emit('get_histry_messages', $scope.talkData.roomid, function(result) {
            if (result != null) {
                result.forEach(function(data) {
                    data.isMine = (data.userid == userData.id);
                });
                $scope.talkData.messages = result;
            }
            
        });
        

        //talkpageへ受け渡す情報を整理すること。


        $scope.myNavigator.pushPage('page2.html', {
            animation: 'slide'
        });
    }

});

messenger.controller('TalkRoomController', function($scope, socket, userData, talkData) {
    console.log("TalkRoomController is loaded");
    $scope.talkData = talkData;
    $scope.text = "";

    var talkContainer = $('#talk-container');
    var talkInnerContainer = $('#talk-inner-container');
    var textBox = $('#global-footer-form-txt'); //あとでdirectiveに書き換える
    textBox.focus();

    //送信ボタンクリック
    $scope.send = function send() {
        textBox.focus();

        //空文字ははじく。
        if ($scope.text != "") {
            var message = {roomid : talkData.roomid,
                           userid : userData.id,
                           text   : $scope.text};

            socket.emit('message', message);
        }
        $scope.text = "";
    }

    var receiveMessage = function(msg) {
        console.log(msg);

        $scope.talkData.messages.push({
            userid: msg.userid,
            text: msg.text,
            isMine: (msg.userid == userData.id)
        });


        talkContainer.animate({
            scrollTop: talkInnerContainer.height()
        }, 20);
    }
    socket.on("message", receiveMessage);

    //メッセージのデータをすべて表示しきったら画面をスクロールする。
    $scope.$on('ngRepeatFinished', function(ngRepeatFinishedEvent) {
        talkContainer.animate({
                scrollTop: talkInnerContainer.height()
            }, 0);
    });
    
    //コントローラーが破棄される際に呼び出される。
    $scope.$on('$destroy', function iVeBeenDismissed() {
        //メッセージを受信するコールバックをすべて解除する。
        socket.removeAllListeners("message", receiveMessage);
    })

});

//とりあえずRoomId生成する
function generateRoomId(userids) {
    userids.sort(
	function(a,b){
    	if( a < b ) return -1;
        if( a > b ) return 1;
        return 0;
    });
    
    var result = "";
    userids.forEach(function(data) {
        result = result + ("000"+data).slice(-4);
    });
    
    return result;
}