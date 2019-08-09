# ClueCon2019-CardsAgainstTechnology
ClueCon 2019 - Cards Against Technology, ClueCon Edition

This project is designed as an example to implement SignalWire's new NodeJS API.
It implements the API leveraging the Relay Consumer and provides a configurable, multi-player SMS game of Cards Against Technologhy - ClueCon Edition.  The cards provided here were created by Ms. Abbi Minessales (https://twitter.com/abbimini) and includes the most famous card ... the "James Body" card, in honor of Mr. James Body, himself (https://twitter.com/jamesbody)!  Once the game has been played, a winner is decided and will subsequently be called roasting the other opponents.

## Goals of Project

* Create a Fully Functional NodeJS Implementation of SignalWire's Messaging API.
* Simulate a game of Cards Against Technology
* Leverage the SPECIAL ClueCon edition of cards.
* Document how everything works.

## Getting Started
To run this project, you must have NodeJS installed.  You must also have a SignalWire account.
You can obtain a SignalWire account by visiting:  https://signalwire.com/signup

The next steps are to install the SignalWire API and other dependencies.

`npm install @signalwire/node`

`npm install https`

Now you must obtain your SignalWire Space, ProductKey and APIToken.  This can be completed on your SignalWire dashboard.  Once you have both secrets add them into the (cluecon_cards.js) project.

`const projectID = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';`

`const apiToken = 'PTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';`

`const spaceURL = 'example.signalwire.com';`

Now, obtain a DID (Phone Number) from SignalWire.  This will be the phone number you will need to text into.
Finally, if you are in trial mode, you must verify any phone number that is used for testing.  Following the Verify instructions within the Phone Numbers tab on the SignalWire Dashboard to complete this process.

## Starting the Bot.
To start the bot, simply perform the following at the command line:
`node cluecon_cards.js`

## Using the Bot.
The bot is designed to direct the user to JOIN a game.

To join, simply text:  `join`

Once the maximum number of players has been reached, the game will start.

## Potential Future Enhancements.
* Currently, only 1 winner is called if there is a tie.
* Would be interesting to call each of the losers to roast them directly.
* Of course, it would be awesome to continue to collaborate on additional cards and loser messages!

### Advanced features... maybe... someday.
* Allow a user to create their own instance of the game and invite participants.
* Allow multiple instances to be run concurrently.
* Allow for the game to timeout while waiting for players to join / respond.

