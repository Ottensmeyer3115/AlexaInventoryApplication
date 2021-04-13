# AlexaInventoryApplication
This project provides some initial structure and patterns for developing an Alexa Skill.
There are other sample Alexa projects that demonstrate the basics, however, 
this project aims to go beyond a single file demo and explore a matured design.  In the end
It works as a simple Item Inventory Application, helping the user take into account a list of 
items he/she has, where they are, and when they were stored there.  Each item is stored in a 
NoSQL database called DynamoDB.
The application is to be deployed as an Amazon Web Services (AWS) Lambda Function. 
You will need an Amazon Web Services account to test the application.

# Deployment
The application is to be deployed as an AWS Lambda Function. Follow these steps for the details on how to set up an Alexa Lambda Function [https://developer.amazon.com/appsandservices/solutions/alexa/alexa-skills-kit/docs/developing-an-alexa-skill-as-a-lambda-function].

At a high level you will need to complete the following steps:

1) Start to create the Alexa Skill in the Amazon Developer Console, go far enough so you can get the Application ID.
2) Build the application using gradlew build.
3) Create the AWS Lambda Function in the AWS Developer Console.
4) Upload the zip from build/distributions to the Lambda Function.
5) Enter the environment variable APPLICATION_ID with Application ID from Step 1.
6) Test the Lambda Function using the AWS Lambda Function developer console (use the Alexa sample template).
7) Deploy the Lambda Function.
8) Return the Alexa Skill developer console and add the deployed Lambda Function's ARN.
Test using the Alexa Skill developer console.

Although the initial setup of the Lambda Function and Alexa Skill can be a little tedious, many of these are one time tasks. After initial configuration you will probably only need to upload new zip files, or change the json schema and sample intents.


