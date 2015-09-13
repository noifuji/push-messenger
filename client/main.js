var messenger = ons.bootstrap('messenger', ['onsen']);
        
messenger.controller('LoginController', function($scope) {

            var socket = io.connect();

            $scope.messages = [];
            $scope.roster = [];
            $scope.username = '';

            socket.on('connect', function() {
                console.log("socket is connected");
            });
            
            socket.on('logged_in', function(flag) {
                $scope.modal.hide();
                console.log(flag);
                if(flag) {
                    $scope.myNavigator.pushPage('page1.html', { animation : 'slide' } );
                } else {
                    alert("Failed to login.");
                }
                
            });

            $scope.login = function login() {
                $scope.showModal();
                console.log('Sending username:' + $scope.username);
                socket.emit('login', $scope.username);
            };
            
            $scope.showModal = function showModal() {
                $scope.modal.show();
            }
        });