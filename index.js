// We used this page as a reference
// https://github.com/bignerdranch/developing-alexa-skills-solutions/blob/master/4_persistence/solution/cakebaker/database_helper.js

'use strict';

const Alexa = require('alexa-sdk');
const awsSDK = require('aws-sdk');
const Promise = require('es6-promisify');

const appId = 'amzn1.ask.skill.43c3e852-3b63-49c5-9c0d-05bc1b7e93d7';
const APP_ID = appId;

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

      console.log('Attempting to read data');
      console.log('\n');
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
      // Get the item name and the location from user's intent invocation
      const item = this.event.request.intent.slots.object.value;
      const location = this.event.request.intent.slots.preposition.value + " " +this.event.request.intent.slots.location.value;

      // Construct the verbal response that Alexa will give
      const speechOutput = "You put " + item + " " + location + ".";

      // Construct the database request
      const dynamoParams = {
              TableName: "MemoryManagerDB",
              Item: {"userid":12,"name":item,"location":location}
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
                  ":userid": 12,
                  ":name":item
              },
              TableName:"MemoryManagerDB"
      };
      // Send the request to find the item from the database
      docClient.query(dynamoParams).promise().then(data => {
          var itemLocation = data.Items[0].location;
          // Alexa responds with the location of the item
          this.emit(':tell', "This item is " + itemLocation);
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
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
