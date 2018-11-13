// We used this page as a reference
// https://github.com/bignerdranch/developing-alexa-skills-solutions/blob/master/4_persistence/solution/cakebaker/database_helper.js

'use strict';
const appId = 'amzn1.ask.skill.43c3e852-3b63-49c5-9c0d-05bc1b7e93d7';
const APP_ID = appId;

const Alexa = require('alexa-sdk');
const awsSDK = require('aws-sdk');
const Promise = require('es6-promisify');

const docClient = new awsSDK.DynamoDB.DocumentClient();

// convert callback style functions to promises
const dbScan = Promise.promisify(docClient.scan, docClient);
const dbGet = Promise.promisify(docClient.get, docClient);
const dbPut = Promise.promisify(docClient.put, docClient);
const dbDelete = Promise.promisify(docClient.delete, docClient);

const SKILL_NAME = 'Memory Manager';
const HELP_MESSAGE = 'You can tell me where youve put an item or ask me to recall where something is. What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';

/* helper method to make article
from opposite person's perspective
*/
function fliparticle(article) {
  if (article=="my"){
    article = "your";
  } else if (article=="your"){
    article = "my";
  }
  return article;
}

/*
  This method will take a timestamp and
  convert it into a time that Alexa can speak.
*/
function speakableTime(timestamp){
    if (timestamp == null || timestamp == "") {
      return "";
    }
    var hour = parseInt(timestamp.substring(11, 13));
    var minute = parseInt(timestamp.substring(14, 16));
    var date = new Date(timestamp);
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                        "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

    // Convert 24 hour time to AM/PM
    var AMPM = "AM";
    if (hour > 12) {
      hour -= 12
      AMPM = "PM";
    } else if (hour == 0) {
      hour = 12;
    }

    // Prepare the minutes into a speakable format
    if (minute == 0) {
      minute = "";//"O clock";
    } else if (minute < 10) {
      minute = "O " + minute;
    }

    var response = "On " + daysOfWeek[date.getDay()] + ", " + months[date.getMonth()] +
                " " + date.getDate() + " at " + hour + " " + minute + " " + AMPM;
    return response;
  }
/*
* This item constructs the parameters for an item name and a userid
*/
function createGetParams(item, theuserid){
    // Construct the request for the database
    const dynamoParams = {
            /*Key:{"userid":{"N":"12"},"name":{"S":"my keys"}},*/
            ConsistentRead: true,
            Select: "ALL_ATTRIBUTES",
            KeyConditionExpression: '#userid = :userid and #name = :name',
            ExpressionAttributeNames: {
                "#userid": "userid",
                "#name": "name"
            },
            ExpressionAttributeValues: {
                ":userid": theuserid,
                ":name":item,
            },
            TableName:"MemoryManagerDB"
    };
    return dynamoParams;
}

var newevent;

const handlers = {
    /*
     * LaunchRequest runs when Memory Manager is opened without invoking an intent
     * After it opens, Memory Manager will wait for a response from the user.
     */
    'LaunchRequest': function () {
        this.emit(':ask', "Memory manager is ready. What can I remember for you?");
    },

    /*
     * The HowMany function can be invoked by the user to determine how many
     * items are being stored in the database for the user.
     */
    'HowManyIntent': function () {
      // Construct the request for the database
      const dynamoParams = {
            TableName: "MemoryManagerDB",
            AttributesToGet: "1",
            Count:"true"
          };
      // send the request to the database. The result will be stored in data
      docClient.scan(dynamoParams).promise().then(data => {
        // respond to the user with the result of the query
        this.emit(':tell', "Memory manger is remembering " + data.Count + " items for you.");
      }).catch(err => console.error(err));

    },

    /*
     * The StoreItem intent can be used to store an item in the database
     * The user will specify the item and the location, and the function will
     * store this information, along with the user's ID in the database.
     */
    'StoreItemIntent': function () {
      var theuserid = newevent.session.user.userId;

      // Get the item name and the location from user's intent invocation
      var article;
      var flippedarticle;
      if (this.event.request.intent.slots.article!=null && !this.event.request.intent.slots.article){
        article = this.event.request.intent.slots.article.value;
        flippedarticle = fliparticle(article);
      } else {
          article = "";
          flippedarticle = "";
      }
      var item = this.event.request.intent.slots.object.value;
      const location = this.event.request.intent.slots.prep.value + " "+
                        this.event.request.intent.slots.location.value;
      const timestamp = this.event.request.timestamp;

      // Construct the verbal response that Alexa will give
      const speechOutput = "You put "+ flippedarticle + " " + item + " " + location + ".";
      console.log(speechOutput);

      // Construct the database request
      const dynamoParams = {
              TableName: "MemoryManagerDB",
              Item: {"userid":theuserid,"name":item,"location":location,"timestamp":timestamp}
      };

      // Send a request to insert the item to the database
      docClient.put(dynamoParams).promise().then(data => {
        // Respond to the user with the result
        this.emit(':tell', speechOutput);
        console.log(data);
      }).catch(err => console.error(err));

    },

    /*
     * The RecallItem intent can be used to retreive information from the
     * database about an item the user previously stored. Alexa will give the
     * location of the item. (future: The user will also be able to ask for
     * more information about the item stored. Then Alexa will respond with
     * additional information.)
     */
    'RecallItemIntent': function () {
      // Get the item name from the request

      const item = this.event.request.intent.slots.object.value;
      var theuserid = newevent.session.user.userId;
      var timestamp = this.event.request.timestamp;

      var timereadable = speakableTime(timestamp);

      var dynamoParams = createGetParams(item, theuserid);

      // Send the request to find the item from the database
      docClient.query(dynamoParams).promise().then(data => {
          var resultItem = data.Items[0];
          if (resultItem != null) {
            // Alexa responds with the location of the item
            this.emit(':tell', timereadable + ", you recorded this item " + resultItem.location);
          } else {
            // If the item was not found in the database, Alexa tells then
            // user that it doesn't know where the item is.
            this.emit(':tell', "I don't know where " + item + " is.")
          }
      }).catch(err => console.error(err));
    },

    /*
     * The DeleteItemIntent is used to have Alexa remove an item fro mthe database.
     * Alexa will respond with a confirmation of the deleted object or will notify the
     * user that the object was not found in the DB.
     */
    'DeleteItemIntent': function () {

      // Get the item name from the request
      const item = this.event.request.intent.slots.object.value;
      const article = this.event.request.intent.slots.article.value;
      var theuserid = newevent.session.user.userId;


      // Construct the request for the database
      const dynamoParams = {
              ConsistentRead: true,
              Select: "ALL_ATTRIBUTES",
              KeyConditionExpression: '#userid = :userid and #name = :name',
              ExpressionAttributeNames: {
                  "#userid": "userid",
                  "#name": "name"
              },
              ExpressionAttributeValues: {
                  ":userid": theuserid,
                  ":name":item,
              },
              TableName:"MemoryManagerDB"
      };

      // Send the request to find the item from the database
      docClient.query(dynamoParams).promise().then(data => {
          var resultItem = data.Items[0];
          if (resultItem != null) {
            // Alexa deletes the item and responds
            var deleteparams = {
                TableName: 'MemoryManagerDB',
                Key: {
                    "userid": theuserid,
                    "name":item
                },
                ReturnValues: 'ALL_OLD'
            };
            docClient.delete(deleteparams).promise().catch(err => console.error(err));
            this.emit(':tell', "I've deleted " +  fliparticle(article) + " "+ resultItem.name);
          } else {
            // If the item was not found in the database, Alexa tells the
            // user that it doesn;t know this object.

            this.emit(':tell', "I don't know about " +fliparticle(article)+ " "+ item)
          }
      }).catch(err => console.error(err));
    },

    /*
     * The help intent is one the Built-in intents.
     */
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        const reprompt = HELP_REPROMPT;

        // Alexa responds with the help message and reprompts the user
        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },

    /*
     * The cancel intent is one of the Built-in intents.
     */
    'AMAZON.CancelIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },

    /*
     * The stop intent is one of the Built-in intents.
     */
    'AMAZON.StopIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
};

// Register the intents with alexa, so that they can be used by the user.
exports.handler = function (event, context, callback) {
  newevent = event;
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
