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
    $scope.username = "";
    //$scope.isPushEnabled = false;

    $scope.dialogs = {};

    $scope.show = function(dlg) {
        if (!$scope.dialogs[dlg]) {
            ons.createDialog(dlg).then(function(dialog) {
                $scope.dialogs[dlg] = dialog;
                dialog.show();
            });
        }
        else {
            $scope.dialogs[dlg].show();
        }
    }

    socket.on('connect', function() {
        console.log("socket is connected");

        // Check that service workers are supported, if so, progressively
        // enhance and add push messaging support, otherwise continue without it.
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js').then(initialiseState(socket));
            //$scope.isPushEnabled = true;

        }
        else {
            console.warn('Service workers aren\'t supported in this browser.'); //@alert 
        }
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

    $scope.pushSubscribe = function pushSubscribe() {
        if (isPushEnabled) {
            unsubscribe(socket);
        }
        else {
            //subscribe(socket);
        }
    };

    $scope.showModal = function showModal() {
        $scope.modal.show();
        timeoutId = setTimeout(function() {
            $scope.modal.hide();
            alert("Timed out");
        }, 6000);
    }
});

messenger.controller('SignupController', function($scope, socket, userData, talkData) {
    console.log("SignupController is loaded");
    $scope.userData = userData;
    $scope.talkData = talkData;
    $scope.username = "";

    $scope.signup = function signup() {
        console.log($scope.username);
        socket.emit('signup', {
            username: $scope.username
        }, function(result) {
            if (result != null) {
                subscribe(socket, result.id);
                $scope.dialog.hide();
            }
            else {
                console.log("This username is already used.");
            }
        });


    };

});


messenger.controller('FreindListController', function($scope, socket, userData, talkData) {
    console.log("FreindListController is loaded");
    $scope.userData = userData;
    $scope.talkData = talkData;
    $scope.dialogs = {};

    //トーク用ページへ遷移する
    $scope.moveToTalkPage = function(index) {
        var selectedItem = $scope.userData.friends[index];
        $scope.talkData.roomid = generateRoomId([selectedItem.id, userData.id]);

        //ルームへ入室する。//TalkRoomControllerの初期処理でやってもいいかも
        socket.emit('join_room', {
            roomid: $scope.talkData.roomid,
            participants: [selectedItem.id, userData.id]
        }, function(result) {
            if (result != null) {
                result.forEach(function(data) {
                    data.isMine = (data.userid == userData.id);
                });
                $scope.talkData.messages = result;
            }

        });

        $scope.myNavigator.pushPage('page2.html', {
            animation: 'slide'
        });
    }
    
    $scope.show = function(dlg) {
        if (!$scope.dialogs[dlg]) {
            ons.createDialog(dlg).then(function(dialog) {
                $scope.dialogs[dlg] = dialog;
                dialog.show();
            });
        }
        else {
            $scope.dialogs[dlg].show();
        }
    }

});

messenger.controller('AddFriendController', function($scope, socket, userData, talkData) {
    console.log("AddFriendController is loaded");
    $scope.userData = userData;
    $scope.talkData = talkData;

    $scope.addFriend = function addFriend() {
        socket.emit('add_friend', {
            userData: $scope.userData,
            friendname: $scope.friendname
        }, function(result) {
            if (result != null) {
                console.log(result);
                $scope.userData = result;
                $scope.dialog.hide();
            }
            else {
                console.log("Something is wrong to add your friend.");
            }
        });


    };

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
            var message = {
                roomid: talkData.roomid,
                userid: userData.id,
                text: $scope.text
            };

            socket.emit('send_message', message);
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
    socket.on("multicast", receiveMessage);

    //メッセージのデータをすべて表示しきったら画面をスクロールする。
    $scope.$on('ngRepeatFinished', function(ngRepeatFinishedEvent) {
        talkContainer.animate({
            scrollTop: talkInnerContainer.height()
        }, 0);
    });

    //コントローラーが破棄される際に呼び出される。
    $scope.$on('$destroy', function iVeBeenDismissed() {
        //メッセージを受信するコールバックをすべて解除する。
        socket.removeAllListeners("multicast", receiveMessage);


        //ルームから退室する
        socket.emit('leave_room', $scope.talkData.roomid, function() {
            console.log("left room");
        });

    })

});

//とりあえずRoomId生成する
function generateRoomId(userids) {
    userids.sort(
        function(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });

    var result = "";
    userids.forEach(function(data) {
        result = result + ("000" + data).slice(-4);
    });

    return result;
}



/**************************
 * 
 * push notificatoin functions
 * 
 * ***********************/
var API_KEY = 'AIzaSyDDgYaIYetAHiJIoF_egwBJwGFSQgw29VI';
var GCM_ENDPOINT = 'https://android.googleapis.com/gcm/send';

var isPushEnabled = false;
var TEXT_ENABLE_NOTIFICATION = 'Enable push messages';
var TEXT_DISABLE_NOTIFICATION = 'Disable push messages';

// Once the service worker is registered set the initial state
function initialiseState(socket) {
    // Are Notifications supported in the service worker?
    if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
        return;
    }

    // Check the current Notification permission.
    // If its denied, it's a permanent block until the
    // user changes the permission
    if (window.Notification.permission === 'denied') {
        return;
    }

    // Check if push messaging is supported
    if (!('PushManager' in window)) {
        return;
    }

    // We need the service worker registration to check for a subscription
    navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
        // Do we already have a push message subscription?
        serviceWorkerRegistration.pushManager.getSubscription().then(function(subscription) {
                // Enable any UI which subscribes / unsubscribes from
                // push messages.
                var pushButton = document.querySelector('.js-push-button'); //@あとでなくす
                pushButton.disabled = false;

                if (!subscription) {
                    // We aren’t subscribed to push, so set UI
                    // to allow the user to enable push
                    console.log("We aren’t subscribed to push");
                    return;
                }

                //return subscription;

                // Keep your server in sync with the latest subscriptionId
                //sendEndpointToServer(socket, subscription);

                // Set your UI to show they have subscribed for
                // push messages
                pushButton.textContent = TEXT_DISABLE_NOTIFICATION; //@あとでなくす
                isPushEnabled = true;
            })
            .catch(function(err) {
                console.log(err instanceof Error);
            });
    });
}

//@引数でなくかえりちにする?
function subscribe(socket, userid) {
    // Disable the button so it can't be changed while
    // we process the permission request
    var pushButton = document.querySelector('.js-push-button');
    pushButton.disabled = true;

    navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
        serviceWorkerRegistration.pushManager.subscribe({
                userVisibleOnly: true
            })
            .then(function(subscription) {
                // The subscription was successful
                isPushEnabled = true;
                pushButton.textContent = TEXT_DISABLE_NOTIFICATION;
                pushButton.disabled = false;

                // TODO: Send the subscription.subscriptionId and 
                // subscription.endpoint to your server
                // and save it to send a push message at a later date
                sendEndpointToServer(socket, subscription, userid);

            })
            .catch(function(e) {
                console.log(e);
                if (window.Notification.permission === 'denied') {
                    // The user denied the notification permission which
                    // means we failed to subscribe and the user will need
                    // to manually change the notification permission to
                    // subscribe to push messages
                    pushButton.disabled = true;
                }
                else {
                    // A problem occurred with the subscription, this can
                    // often be down to an issue or lack of the gcm_sender_id
                    // and / or gcm_user_visible_only
                    pushButton.disabled = false;
                    pushButton.textContent = TEXT_ENABLE_NOTIFICATION;
                }
            });
    });
}

function unsubscribe(socket) {
    var pushButton = document.querySelector('.js-push-button');
    pushButton.disabled = true;

    navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
        // To unsubscribe from push messaging, you need get the
        // subcription object, which you can call unsubscribe() on.
        serviceWorkerRegistration.pushManager.getSubscription().then(
            function(pushSubscription) {
                // Check we have a subscription to unsubscribe
                if (!pushSubscription) {
                    // No subscription object, so set the state
                    // to allow the user to subscribe to push
                    isPushEnabled = false;
                    pushButton.disabled = false;
                    pushButton.textContent = TEXT_ENABLE_NOTIFICATION;
                    return;
                }

                // TODO: Make a request to your server to remove
                // the subscriptionId from your data store so you 
                // don't attempt to send them push messages anymore
                deleteEndpointFromServer(socket, pushSubscription);

                // We have a subcription, so call unsubscribe on it
                pushSubscription.unsubscribe().then(function(successful) {
                    pushButton.disabled = false;
                    pushButton.textContent = TEXT_ENABLE_NOTIFICATION;
                    isPushEnabled = false;
                }).catch(function(e) {
                    // We failed to unsubscribe, this can lead to
                    // an unusual state, so may be best to remove 
                    // the subscription id from your data store and 
                    // inform the user that you disabled push

                    pushButton.disabled = false;
                });
            }).catch(function(e) {});
    });
}

// This method handles the removal of subscriptionId
// in Chrome 44 by concatenating the subscription Id
// to the subscription endpoint
function endpointWorkaround(pushSubscription) {
    // Make sure we only mess with GCM
    if (pushSubscription.endpoint.indexOf('https://android.googleapis.com/gcm/send') !== 0) {
        return pushSubscription.endpoint;
    }

    var mergedEndpoint = pushSubscription.endpoint;
    // Chrome 42 + 43 will not have the subscriptionId attached
    // to the endpoint.
    if (pushSubscription.subscriptionId &&
        pushSubscription.endpoint.indexOf(pushSubscription.subscriptionId) === -1) {
        // Handle version 42 where you have separate subId and Endpoint
        mergedEndpoint = pushSubscription.endpoint + '/' +
            pushSubscription.subscriptionId;
    }
    return mergedEndpoint;
}

//Chrome 44 later
function getEndpoint(pushSubscription) {
    var mergedEndpoint = endpointWorkaround(pushSubscription);
    var endpointSections = mergedEndpoint.split('/');
    var subscriptionId = endpointSections[endpointSections.length - 1];

    return subscriptionId;
}

//Sends request to register the endpoint.
function sendEndpointToServer(socket, subscription, userid) {
    var endpoint = getEndpoint(subscription);
    socket.emit('register_endpoint', {
        userid: userid,
        endpoint: endpoint
    });
}

//Sends request to delete the endpoint on the server.
function deleteEndpointFromServer(socket, subscription) {
    var endpoint = getEndpoint(subscription);
    var socket = io.connect();
    socket.emit('delete_endpoint', endpoint);
}