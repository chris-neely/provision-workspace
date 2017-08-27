// Dependencies
var https = require('https');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

// Settings
var host = 'tenant.okta.com'; // Your okta tenant domain without http or https appended
var appID = ''; // Application ID for the Okta application to monitor events for
var apiToken = ''; // Your Okta API Token
var objectType = 'app.generic.provision.assign_user_to_app'; // Okta event object type - http://developer.okta.com/docs/api/resources/events.html#applications
var scanMins = 60; // Define how far back we should grab events from Okta in Minutes
var groupSize = 20;  // Define how many workspaces you want to provision per batch
var awsBucket = 'workspace-tasks/create-workspace-standard'; // Define the s3 bucket to put files in

// Define Variables for later user
var jsonObj = '';
var userEmails = [];

// Get current date and subtract an hour then convert to ISO 8601
var date = new Date();
date.setMinutes(date.getMinutes() - scanMins);
var isodate = date.toISOString();

// Define Okta HTTPS request variables
var provPath = "/api/v1/events?filter=action.objectType+eq+%22" + objectType + "%22+and+target.id+eq+%22" + appID + "%22+and+published+gt+%22" + isodate + "%22+and+target.objectType+eq+%22User%22";
var method = 'GET';
var headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': "SSWS " + apiToken
};

// Gather Param options for https request
var httpsOptions = {
    host: host,
    path: provPath,
    method: method,
    headers: headers
};

// Function for Okta https request with callback to makeWS function
var httpsCallback = function (oktaResponse) {
    var body = '';

    //another chunk of data has been received, so append it to `body`
    oktaResponse.on('data', function (chunk) {
        body += chunk;
    });

    //the whole response has been received, lets save the users to s3
    oktaResponse.on('end', function () {
        jsonObj = JSON.parse(body);
        // Get list of user emails and push to json array
        for (var i = 0; i < jsonObj.length; i++) {
            userEmails.push(jsonObj[i].targets[0].login);
        }
        console.log("Okta response: " + userEmails);

        // Batch userEmails into smaller groups
        var groups = userEmails.map( function(item, index){
            return index % groupSize === 0 ? userEmails.slice(index, index + groupSize) : null; 
        })
            .filter(function(item){ return item; 
        });
        console.log("Response grouped as batches: " + groups);

        // Save batches to s3
        for (var j = 0; j < groups.length; j++) {
            var emailString = JSON.stringify(groups[j]);
            //define s3 parameters
            var s3params = {
                Bucket : awsBucket,
                Key : isodate + '_batch_' + j + '.txt',
                Body : emailString
            };

            //put in bucket
            s3.putObject(s3params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     console.log(data);           // successful response
            });
        }

    });
};

// Call http request method for provisioning users
exports.handler = function(event, context) {
    jsonObj = '';  // Clear this variable to make sure it is idempotent
    userEmails = []; // Clear this variable to make sure it is idempotent
    https.request(httpsOptions, httpsCallback).end();
};