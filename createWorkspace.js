// Dependencies
'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
const workspaces = new AWS.WorkSpaces({apiVersion: '2015-04-08'});

// AWS Settings / Constants
AWS.config.region = 'us-east-1'; // Your AWS Region
var bundleId = "wsb-000000000"; // Your workspace bundle ID
var directoryId = "d-0000000000"; // Your workspace directory ID
var rootVolEncryption = false; // Do you want the root volume to be encrypted?
var userVolEncryption = false; // Do you want the user volume to be encrypted?
var RunningMode = 'AUTO_STOP'; // AUTO_STOP or ALWAYS_ON
var RunningModeAutoStopTimeout = '60'; // Number of minutes for Auto Stop
var wsTagKey = 'Image'; // Make this anything you want, I use it to keep track of which image it is deploying
var wsTagValue = 'WIN7_V0.01';  // Value for the above tag key

// Function to loop through the s3 object and create a workspace for each user
exports.handler = (event, context, callback) => {
    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    const params = {
        Bucket: bucket,
        Key: key,
    };
    s3.getObject(params, (err, data) => {
        if (err) {
            console.log(err);
            const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`; 
            console.log(message);
            callback(message);
        } else {
            console.log("Raw Data: " + data.Body.toString('utf-8'));
            var jsonObj = JSON.parse(data.Body);
            console.log("JSON Object: " + jsonObj);
            for (var i = 0; i < jsonObj.length; i++) {
                setTimeout(function (i) {
                    var userEmail = jsonObj[i];
                    var userName = userEmail.substr(0, userEmail.indexOf('@'));

                    // Gather parameters to create workspace
                    var awsProvParams = {
                        "Workspaces": [
                            {
                                "BundleId": bundleId,
                                "DirectoryId": directoryId,
                                "RootVolumeEncryptionEnabled": rootVolEncryption,
                                "Tags": [
                                    {
                                     "Key": wsTagKey,
                                     "Value": wsTagValue
                                    }
                                ],
                                "UserName": userName,
                                "UserVolumeEncryptionEnabled": userVolEncryption,
                                "WorkspaceProperties": {
                                    "RunningMode": RunningMode,
                                    "RunningModeAutoStopTimeoutInMinutes": RunningModeAutoStopTimeout
                                }
                            }
                        ]
                    };

                    // Method to create workspace for user
                    workspaces.createWorkspaces(awsProvParams, function (provErr, provData) {
                        if (provErr) {
                            console.log("Error: " + JSON.stringify(provErr, provErr.stack));
                        } else {
                            if (provData.FailedRequests[0] != undefined) {
                                console.log("Error: " + provData.FailedRequests[0].ErrorMessage + " - " + userName);
                            } else {
                                console.log("Success: " + JSON.stringify(provData));
                            }
                        }
                    });
                }, 1500 * i, i);
            }
            callback(null, data);
        }
    });
};
