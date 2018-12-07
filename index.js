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
const HELP_MESSAGE = 'Memory Manager is an app that helps you remember item locations. For example you could say: \"I put my keys in my drawer\", or, "\"Where did I put my keys\", or maybe, \"Forget about my keys\".' +
' Also, if you say \"List all items\", or ,\"How many items\", I can tell you about what is in memory.';
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
function speakableTime(timestamp, timezone){
  if (timestamp == null || timestamp == "" || !timezone) {
    return "";
  }
  var hour = parseInt(timestamp.substring(11, 13));
  var minute = parseInt(timestamp.substring(14, 16));
  var date = new Date(timestamp);
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

  hour += timezone;
  if (hour < 0) {
    date.setDate(date.getDate()-1);
    hour += 24;
  }

  // Convert 24 hour time to AM/PM
  var AMPM = "AM";
  if (hour > 12) {
    hour -= 12;
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
    this.emit(':ask', "Memory manager is ready. For help just say: help.");
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
      this.emit(':tell', "Memory Manager is remembering " + data.Count + " items for you.");
    }).catch(err => console.error(err));

  },

  /*
  * The StoreItem intent can be used to store an item in the database
  * The user will specify the item and the location, and the function will
  * store this information, along with the user's ID in the database.
  */
  'StoreItemIntent': function () {
    var theuserid = newevent.session.user.userId;

    const dynamoTimeZoneParams = {
      ConsistentRead: true,
      Select: "ALL_ATTRIBUTES",
      KeyConditionExpression: '#userid = :userid',
      ExpressionAttributeNames: {
        "#userid": "userid"
      },
      ExpressionAttributeValues: {
        ":userid": theuserid,
      },
      TableName:"MemoryManagerTimeZone"
    };

    // Send the request to find if the user has a timezone
    docClient.query(dynamoTimeZoneParams).promise().then(data => {
      var resultItem = data.Items[0];
      if (resultItem == null) {
          this.emit(":tell", "I need to know your time zone before I can record an item for you. "+
        "Please say something like the following: \"I'm in Mountain time\", or \"I'm on Eastern Standard Time\"");
        return;
      }
    }).catch(err => console.error(err));

    // Get the item name and the location from user's intent invocation
    var article;
    var flippedarticle;
    if (this.event.request.intent.slots.article!=null || !this.event.request.intent.slots.article){
      article = this.event.request.intent.slots.article.value;
      flippedarticle = fliparticle(article);
    } else {
      article = "";
      flippedarticle = "";
    }
    var item = this.event.request.intent.slots.object.value;
    var location = this.event.request.intent.slots.prep.value + " "+
    this.event.request.intent.slots.location.value;
    const timestamp = this.event.request.timestamp;

    location = location.replace(new RegExp(" my ", 'g')," your ");

    // Construct the verbal response that Alexa will give
    const speechOutput = "You put "+ flippedarticle + " " + item + " " + location + ".";
    console.log(speechOutput);

    // Construct the database request
    var dynamoParams = {
      TableName: "MemoryManagerDB",
      Item: {"userid":theuserid,"name":item,"location":location,"timestamp":timestamp, "article":article}
    };

    if (!article){
      dynamoParams = {
        TableName: "MemoryManagerDB",
        Item: {"userid":theuserid,"name":item,"location":location,"timestamp":timestamp}
      };
    }

    // Send a request to insert the item to the database
    docClient.put(dynamoParams).promise().then(data => {
      // Respond to the user with the result
      this.emit(':tell', speechOutput);
      console.log(data);
    }).catch(err => console.error(err));

  },

  'TimeZoneIntent': function () {
    var theuserid = newevent.session.user.userId;

    var timezone = this.event.request.intent.slots.time.value;
    var timezonenum = 0;
    if (timezone.includes("central")){
      timezonenum = -6;
    }
    if (timezone.includes("pacific")){
      timezonenum = -8;
    }
    if (timezone.includes("eastern")){
      timezonenum = -5;
    }
    if (timezone.includes("mountain")){
      timezonenum = -7;
    }

    if (timezonenum == 0){
      this.emit(':tell', "OK. " + "Sorry, but that's not a North American time zone I can use.");
      return;
    }

    // Construct the database request
    var dynamoParams = {
      TableName: "MemoryManagerTimeZone",
      Item: {"userid":theuserid,"timezone":timezonenum}
    };



    // Send a request to insert the item to the database
    docClient.put(dynamoParams).promise().then(data => {
      // Respond to the user with the result
      this.emit(':tell', "OK. " + "I'll remember you're in " + timezone + " time. Go ahead and store something in memory now!");
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
    var article = "";
    if (this.event.request.intent.slots.article.value){
      article = fliparticle(this.event.request.intent.slots.article.value) + " ";
    }
    var theuserid = newevent.session.user.userId;

    const dynamoTimeZoneParams = {
      ConsistentRead: true,
      Select: "ALL_ATTRIBUTES",
      KeyConditionExpression: '#userid = :userid',
      ExpressionAttributeNames: {
        "#userid": "userid"
      },
      ExpressionAttributeValues: {
        ":userid": theuserid,
      },
      TableName:"MemoryManagerTimeZone"
    };
    var timezone = "";
    // Send the request to find if the user has a timezone
    docClient.query(dynamoTimeZoneParams).promise().then(data => {
      var resultItem = data.Items[0];
      if (resultItem != null) {
        timezone = data.Items[0].timezone;
      }
    }).catch(err => console.error(err));

    var dynamoParams = createGetParams(item, theuserid);

    // Send the request to find the item from the database
    docClient.query(dynamoParams).promise().then(data => {
      var resultItem = data.Items[0];
      if (resultItem != null) {
        // Alexa responds with the location of the item
        if (resultItem.article){
          this.emit(':tell',speakableTime(data.Items[0].timestamp, timezone)  + ", you recorded " + resultItem.article + " " + resultItem.name + " " + resultItem.location);
        } else {
          this.emit(':tell',speakableTime(data.Items[0].timestamp, timezone)  + ", you recorded " + resultItem.name + " " + resultItem.location);
        }

      } else {
        // If the item was not found in the database, Alexa tells then
        // user that it doesn't know where the item is.

        this.emit(':tell', "I don't know where " +article +item + " is.")
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

        this.emit(':tell', "I don't know about " + fliparticle(article) + " " + item)
      }
    }).catch(err => console.error(err));
  },

  /*
  * The ListIntent is used to have Alexa list all Items
  * that are currently being stored in DynamoDB.
  */
  'ListIntent': function () {
    var theuserid = newevent.session.user.userId;


    // Construct the request for the database
    const dynamoParams = {
      ConsistentRead: true,
      Select: "ALL_ATTRIBUTES",
      KeyConditionExpression: '#userid = :userid',
      ExpressionAttributeNames: {
        "#userid": "userid"
      },
      ExpressionAttributeValues: {
        ":userid": theuserid
      },
      TableName:"MemoryManagerDB"
    };

    // send the request to the database. The result will be stored in data
    docClient.query(dynamoParams).promise().then(data => {
      // respond to the user with the result of the query
      var listString = "";
      for (var index in data.Items) {
        if (index >= 1 && index != data.Items.length - 1){
          listString += ", ";
        }
        listString += data.Items[index].name.trim();
        if (index == data.Items.length-2){
          listString += ", and ";
        }
      }
      this.emit(':tell', "Memory manager is currently remembering your " + listString + ".");

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
