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
    'LaunchRequest': function () {
        this.emit(':ask', "Memory manager is ready. What can I remember for you?");
    },
    'HowManyIntent': function () {
      const dynamoParams = {
            TableName: "MemoryManagerDB",
            AttributesToGet: "1",
            Count:"true"
          };

      console.log('Attempting to read data');
      console.log('\n');
      docClient.scan(dynamoParams).promise().then(data => {
        this.emit(':ask', "Memory manger is remembering " + data.Count + " items for you. Anything else?");
      }).catch(err => console.error(err));

    },
    'StoreItemIntent': function () {
        const item = this.event.request.intent.slots.object.value;
        const location = this.event.request.intent.slots.preposition.value + " " +this.event.request.intent.slots.location.value;
        const speechOutput = "You put " + item + " " + location + ".";

        const dynamoParams = {
              TableName: "MemoryManagerDB",
              Item: {"userid":12,"name":item,"location":location}
        };

        docClient.put(dynamoParams).promise().then(data => {
          this.emit(':ask', speechOutput +" Anything else?");
          console.log(data);
        }).catch(err => console.error(err));

    },
    'RecallItemIntent': function () {
        const item = this.event.request.intent.slots.object.value;

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
                  ":name":"plate"
              },
              TableName:"MemoryManagerDB"
        };

        docClient.query(dynamoParams).promise().then(data => {
          var itemLocation = data.Items[0].location;
          this.emit(':ask', "This item is " + itemLocation +". Anything else?");
        }).catch(err => console.error(err));
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        const reprompt = HELP_REPROMPT;

        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        this.response.speak(STOP_MESSAGE);
        this.emit(':responseReady');
    },
};

exports.handler = function (event, context, callback) {
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
