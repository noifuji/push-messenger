'use strict';

/*
*Written by Ryoma
*2015/9/9
*/

self.addEventListener('push', function(event) {
  console.log('Received a push message', event);

  var title = 'push-messenger';
  var body = "You've got a message";
  var icon = '/img/gouchi.jpg';
  var tag = 'tag';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      tag: tag
    })
  );
});


self.addEventListener('notificationclick', function(event) {
  console.log('On notification click: ', event.notification.tag);
  // Android doesn’t close the notification when you click on it
  // See: http://crbug.com/463146
  event.notification.close();

  // This looks to see if the current is already open and
  // focuses if it is
  
  event.waitUntil(clients.matchAll({
    type: "window"
  }).then(function(clientList) {
    console.log(clientList);
    for (var i = 0; i < clientList.length; i++) {
      var client = clientList[i];
      if (client.url == 'https://push-messenger-noifuji.c9.io/chat.html' && 'focus' in client)
        return client.focus();
    }
    if (clients.openWindow)
      return clients.openWindow('./chat.html');
  }));
  

});
