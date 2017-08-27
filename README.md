# provision-workspace
Provision AWS Workspace based on Okta application events using AWS Lambda

## Summary
How this currently works
1. getWorkspaceUsers.js runs as an AWS Lambda function that checks a dummy Okta application for 'user assignment' events once per hour.  I have a 'bookmark app` created in Okta and then a group assigned to the app to generate the 'user assignment' events.
2. If there have been users assigned to the application then the function gets the email addresses of said users and then creates a text file with a json array of the email addresses which is then saved to an AWS S3 bucket. In order to keep from flooding the AWS API with a larger number of workspace provisioning events the function has a variable you can configure (groupSize) to set the number of email addresses you want to save in each file.
3. createWorkspace.js runs as an AWS Lambda function which is triggered when the txt file from the getWorkspaceUsers function is saved in the appropriate AWS S3 bucket.
4. The createWorkspace function parses the list of email addresses in the txt file and strips the domain name and launches a workspace for the user. This assumes that your sAMAccountName is the same as the user's email address prefix. This function also has a loop which I'm using for a throttle (as a workaround) so only one workspace is submitted to be provisioned every 1500ms.