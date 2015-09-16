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
        }
    };
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

messenger.controller('LoginController', function($scope, socket, userData) {

    var timeoutId = null;
    $scope.userData = userData;

    socket.on('connect', function() {
        console.log("socket is connected");
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


messenger.controller('FreindListController', function($scope, socket, userData) {
    console.log("FreindListController is loaded");

    $scope.userData = userData;

    /*            $scope.users = [{"name":"ryoma", "desc":"frfrfrf", "icon":"sax.jpg"}
                            ,{"name":"hige", "desc":"I love Samuragouchi.", "icon":"gouchi.jpg"}
                            ,{"name":"okaya", "desc":"tired tired tired", "icon":"icon.jpg"}];*/

});

messenger.controller('TalkRoomController', function($scope, socket, userData) {
    console.log("TalkRoomController is loaded");

    $scope.userData = userData
    $scope.messages = [];
    $scope.message = "";
    
    var talkContainer = $('#talk-container');
    var talkInnerContainer = $('#talk-inner-container');
    var msg = $('.msg');
    var text = $('#global-footer-form-txt'); //あとでdirectiveに書き換える
    text.focus();
    
    //送信ボタンクリック
    $scope.send = function send() {
        text.focus();
        
        //空文字ははじく。メッセージを追加して、スクロールする。
        if ($scope.message != "") {
            $scope.messages.push($scope.message);
            talkContainer.animate({
                scrollTop: talkInnerContainer.height()
            }, 200);
        }
        $scope.message = "";
    }

});