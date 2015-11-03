//bootstrapを読み込んでいる
var messenger = ons.bootstrap('messenger', ['onsen']);

//ng-Controllerで定義したコントローラ
//$scopeでもでるを共有できる
//myNavigatorも$scopeの中に入っているので、このコントローラ内からmyNavigator.pushPage()とやることで画面遷移もできる。
messenger.controller('LoginController', function($scope) {

            //サーバーとwebsocketの通信を開始している
            var socket = io.connect();

            //コントローラのスコープ内で使用するモデルの初期化を行っている。
            $scope.username = '';

           //サーバーからconnectイベントが送られてきたときに動く
            socket.on('connect', function() {
                console.log("socket is connected");
            });
            
            //サーバーからlogged_inイベントが送られてきたときに動く
            //見てわかるようにイベントはどんどん自作できる
            //よかったらサーバー側のこーども見てね
            socket.on('logged_in', function(flag) {
                $scope.modal.hide();
                console.log("result:" + flag);
            });

           //$scopeにはこんな風に関数も入れられる。こうしておくことで、htmlファイルから次のように呼び出すこともできる。
           // <div ng-click="login()"></div> もちろんコントローラのスコープ内にいる必要がある。
           //この関数は使ってないから気にしないで。
            $scope.login = function login() {
                $scope.showModal();
                console.log('Sending username:' + $scope.username);
                socket.emit('login', $scope.username);
            };
        });