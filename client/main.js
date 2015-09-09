/*
*Written by Ryoma
*2015/9/8
*/
var API_KEY = 'AIzaSyDDgYaIYetAHiJIoF_egwBJwGFSQgw29VI';
var GCM_ENDPOINT = 'https://android.googleapis.com/gcm/send';

var curlCommandDiv;
var isPushEnabled = false;
var TEXT_ENABLE_NOTIFICATION = 'Enable push messages';
var TEXT_DISABLE_NOTIFICATION = 'Disable push messages';

//Called when index.html is loaded
window.addEventListener('load', function() {
  var pushButton = document.querySelector('.js-push-button');
  curlCommandDiv = document.querySelector('.js-curl-command');
  pushButton.addEventListener('click', function() {
    if (isPushEnabled) {
      unsubscribe();
    } else {
      subscribe();
    }
  });

  // Check that service workers are supported, if so, progressively
  // enhance and add push messaging support, otherwise continue without it.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(initialiseState);
  } else {
    console.warn('Service workers aren\'t supported in this browser.');  
  }
});

// Once the service worker is registered set the initial state
function initialiseState() {
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
        var pushButton = document.querySelector('.js-push-button');
        pushButton.disabled = false;

        if (!subscription) {
          // We aren’t subscribed to push, so set UI
          // to allow the user to enable push
          console.log("We aren’t subscribed to push");
          return;
        }

        // Keep your server in sync with the latest subscriptionId
        //sendSubscriptionToServer(subscription);

        var mergedEndpoint = endpointWorkaround(subscription);
        
        showCurlCommand(mergedEndpoint);

        // Set your UI to show they have subscribed for
        // push messages
        pushButton.textContent = TEXT_DISABLE_NOTIFICATION;
        isPushEnabled = true;
      })
      .catch(function(err) {
      });
  });
}

function subscribe() {
  // Disable the button so it can't be changed while
  // we process the permission request
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;

  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
    serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly: true})
      .then(function(subscription) {
        // The subscription was successful
        isPushEnabled = true;
        pushButton.textContent = TEXT_DISABLE_NOTIFICATION;
        pushButton.disabled = false;

        var mergedEndpoint = endpointWorkaround(subscription);
        
        showCurlCommand(mergedEndpoint);

        // TODO: Send the subscription.subscriptionId and 
        // subscription.endpoint to your server
        // and save it to send a push message at a later date
        //return sendSubscriptionToServer(subscription);
        return;
      })
      .catch(function(e) {
        console.log(e);
        if (window.Notification.permission === 'denied') {
          // The user denied the notification permission which
          // means we failed to subscribe and the user will need
          // to manually change the notification permission to
          // subscribe to push messages
          pushButton.disabled = true;
        } else {
          // A problem occurred with the subscription, this can
          // often be down to an issue or lack of the gcm_sender_id
          // and / or gcm_user_visible_only
          pushButton.disabled = false;
          pushButton.textContent = TEXT_ENABLE_NOTIFICATION;
        }
      });
  });
}

function unsubscribe() {
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;
  curlCommandDiv.textContent = '';

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

        var subscriptionId = pushSubscription.subscriptionId;
        // TODO: Make a request to your server to remove
        // the subscriptionId from your data store so you 
        // don't attempt to send them push messages anymore

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
      }).catch(function(e) {
      });
  });
}

function showCurlCommand(mergedEndpoint) {
  /*Until Chrome 44*/
  //var curlCommand = '<h2>下記コマンドを端末上で叩くとプッシュ通知を送信できる</h2><p>curl --header "Authorization: key=' + API_KEY +
  //  '" --header Content-Type:"application/json" ' + endpoint + 
  //  ' -d "{\\"registration_ids\\":[\\"' + subscriptionId + '\\"]}"</p>';
   
  
  // The curl command to trigger a push message straight from GCM
  if (mergedEndpoint.indexOf(GCM_ENDPOINT) !== 0) {
    console.log('This browser isn\'t currently ' +
      'supported for this demo');
    return;
  }

  var endpointSections = mergedEndpoint.split('/');
  var subscriptionId = endpointSections[endpointSections.length - 1];

  var curlCommand = 'curl --header "Authorization: key=' + API_KEY +
    '" --header Content-Type:"application/json" ' + GCM_ENDPOINT +
    ' -d "{\\"registration_ids\\":[\\"' + subscriptionId + '\\"]}"';

  console.log(curlCommandDiv);

  curlCommandDiv.textContent = curlCommand;
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