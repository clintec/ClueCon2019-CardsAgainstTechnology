//--------------------------------------------------------
/*
    ClueCon 2019 - Cards Against Technology, ClueCon Edition
    by Chris Cline

    -- Player Object
    player = {
        "number" : "+12345677",
        "name"   : "Bob",
        "cards"  : [{card object}],
        "wins"   : 0
    }

    -- Card Object  (blackcards.json & whitecards.json)
    card = {
        "id" : "12",
        "text" : "Something Goes Here."
    }

    -- Loser Message Object (losermessages.json)
    loserMsg = {
        "id" : "7",
        "text" : "Something Funny Here"
    }
*/

// Dependencies
const { RelayConsumer } = require('@signalwire/node');
const blackCards = require('./blackcards.json');
const whiteCards = require('./whitecards.json');
const loserMessages = require('./losermessages.json');

// SignalWire Project/API Secrets
const projectID = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
const apiToken = 'PTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const spaceURL = 'example.signalwire.com';

// Game Configuration Settings
const max_players = 3;          // total maximum number of players
const numberOfRounds = 3;       // Total number of rounds to play
const numberOfWhiteCards = 3;   // number of white cards to deal out per player / per round.

// Other Global Variables
let fromHost = "";              // Host of game 
let judgeIndex = 0;             // Keeps track of judge recycling
let players = {};               // List of Players
let playerCount = 0;            // # of players
let judge = {};                 // Current Judge
let blackcard = {};             // Current Blackcard
let gameStarted = false;        // Has the Game Started
let usedCards = {};             // Used to ensure cards are only selected once per round
let waitingRoom = {};           // Temporary holding spot for players awaiting name entry
let judgeSelections = {};       // Options available for judge to select from
let judgeSelectionCount = 0;    // # of options available for judge to select from.
let roundIndex = 0;             // Current Round
let topWinner = {};             // Player with most wins.
let tiedPlayers = {};           // Other players tied with topWinner.

// gameState = { NOT_STARTED, STARTED, ROUND_IN_PROGRESS, ROUND_COMPLETE }
let gameState = "NOT_STARTED";

//--------------------------------------------------------
// Calling Functions

/*
    This function will place a telephony call to a number and leverage a text-to-speech engine 
    to play a message to the recipient.
    @param string number Phone number to call
    @param string message Message to TTS to callee.
*/
const _callNumberWithTTSMessage = async (number, message) => {
    console.log("Calling number: " + number + "\nWith Message:\n" + message);
    var dialResult = await consumer.client.calling.dial({
        type: 'phone',
        from: fromHost,
        to: number,
        timeout: 30
    });

      if (dialResult.successful) {
        console.log("Dialing was successful.");
        var call = dialResult.call;
        // within an async function ..
        var playResult = await call.playTTS({ text: message, gender: 'male' });
        var hangupResult = await call.hangup()
        if (hangupResult.successful) {
            console.log("Hanging up.");
        }
      }  
}

/*
    This function will place a telephony call to a player and leverage a text-to-speech engine 
    to play a message to the recipient.
    @param <playerObj> player Player to call
    @param string message Message to TTS to callee.
*/
const _callPlayerWithTTSMessage = async (player, message) => {
    console.log("Calling player: " + player.name + "\nWith Message:\n" + message);
    _callNumberWithTTSMessage(player.number, message);
}

//--------------------------------------------------------
// SMS Functions
/*
    This function will send a text to a number.
    @param string number Phone number to send the text to.
    @param string message Message to text.
*/
const _sendMessageToNumber = async (number, message) => {
    console.log("Number: " + number + "\nMessage: " + message);
    console.log("Message Length: " + message.length);

    var newMsg = {
        context: 'default',
        from: fromHost,
        to: number,
        body: message
      };

    console.log("Message: " + JSON.stringify(newMsg));
    let result = await consumer.client.messaging.send(newMsg);
    
      if (result.successful) {
        console.log('Message ID: ', result.messageId)
    } else {
        console.log("Errors were thrown: \n" + JSON.stringify(result));

    }
}

/*
    This function will send a text to a player.
    @param <playerObj> Player Player to send the text to.
    @param string message Message to text.
*/
const _sendMessageToPlayer = (player, message) => {
    setTimeout(function(){ _sendMessageToNumber(player.number, message); }, 2000);
    
}

/*
    This function will send a text to all players.
    @param string message Message to text.
*/
const _sendMessageToAllPlayers = (message) => {
    for (var player_key in players) {
        var player = players[player_key];
        _sendMessageToPlayer(player, message);
    }    
}

/*
    This function will send a text to all players, except the judge.
    @param string message Message to text.
*/
const _sendMessageToAllPlayersButJudge = (message) => {
    for (var player_key in players) {
        var player = players[player_key];
        if (player.number != judge.number) {
            _sendMessageToPlayer(player, message);
        }
    }    
}

/*
    This function will provide the game logic to process an incoming message.
    @param <Relay.Message> message SMS Message to procecss.
*/
const _processIncomingMessage = (message) => {
    console.log("Processing new message: [" + message.from + "|" + message.body + "]");
    console.log("GameState: " + gameState);
    switch (gameState) {
        case "NOT_STARTED":
            if (message.body.toUpperCase() == "JOIN") {
                // player wants to join
                _join(message);
            } else {
                // see if player is in waiting waitingRoom
                if (waitingRoom[message.from] != null) {
                    _namePlayer(message);
                } else {
                    // tell user they must type JOIN.
                    _sendMessageToNumber(message.from, "Type JOIN to play.");
                }
            }
            break;
        case "STARTED":
            // determine if this is a player.
            var player = players[message.from];
            if (player == null) {
                // non-player, issue message.
                var msg = "Game in progress, try again later.";
                _sendMessageToNumber(message.from, msg);
            } else {
                // round hasn't started yet.
                
                var msg = player.name + ", please be patient while we wait for the round to start.";
                _sendMessageToPlayer(player, msg);
            }
            break;
        case "ROUND_IN_PROGRESS":
            // determine if this is a player.
            var player = players[message.from];
            if (player == null) {
                // non-player, issue message.
                var msg = "Game in progress, try again later.";
                _sendMessageToNumber(message.from, msg);
            } else {
                console.log("Response from " + player.name + ": " + message.body);
                // Determine if the response came from the judge.
                if (player.number == judge.number) {
                    // judge's selection.
                    if (judgeSelectionCount != (playerCount - 1)) {
                        _sendMessageToPlayer(judge, "Not all players have selected yet.\nPlease be patient.");
                    } else {
                        var selection = judgeSelections[message.body];
                        if (selection == null) {
                            _sendMessageToPlayer(judge, "Invalid Selection, try again.");
                        } else {
                            console.log("Judge has made the selection: " + selection.card.text);
                            judge.selected = selection;
                            _completeRound();
                        }
                    }
                } else {
                    // determine if this was a selectable response.
                    var card = player.cards[message.body];
                    if (card == null) {
                        _sendMessageToPlayer(player, "Invalid Selection, try again.");
                    } else {
                        // only allow player to utilize their initial selection.
                        if (player.selected == 0) {
                            // valid card
                            player.selected = message.body;
                            var selection = {
                                player : player,
                                card : card
                            };
                            judgeSelectionCount += 1;
                            console.log("Adding player response to judges selection: " + card.text);
                            judgeSelections[judgeSelectionCount] = selection;

                            // determine if this was the last selection we were waiting on.
                            if (judgeSelectionCount == (playerCount - 1)) {
                                // give selections to the judge.
                                var msg = "Players have all selected, here are your options.\n\n" + blackcard.text + "\n\n";
                                for (var select_key in judgeSelections) {
                                    var selection = judgeSelections[select_key];
                                    msg += ("[" + select_key + "] - " + selection.card.text + "\n");
                                    _sendMessageToAllPlayersButJudge(selection.player.name + " selected: " + selection.card.text);

                                }
                                msg += "Which entry wins?";
                                _sendMessageToPlayer(judge, msg);
                            }
                        } else {
                            _sendMessageToPlayer(player, "You have already selected your card.\n" + 
                                    "You selected: " + player.cards[player.selected].text);
                        }
                    }
                }
            }
            break;
        case "ROUND_COMPLETE":
            // determine if this is a player.
            var player = players[message.from];
            if (player == null) {
                // non-player, issue message.
                var msg = "Game in progress, try again later.";
                _sendMessageToNumber(message.from, msg);
            } else {
                // round hasn't started yet.
                
                var msg = player.name + ", please be patient while we wait for the round to start.";
                _sendMessageToPlayer(player, msg);
            }
            break;
    }
}    

/*
    This function places the potential player in the waiting room and requests that they
    enter their name to complete entry in the game.
    @param <Relay.Message> message Details to manage player.
*/
const _join = (message) => {
    // add potential player to waitingRoom.
    console.log("Adding [" + message.from + "] to the waiting room.");
    waitingRoom[message.from] = message.from;

   // request player name
   var msg = "Please enter your player name.";
   _sendMessageToNumber(message.from, msg);
}

/*
    This function returns a string object that contains a full list of players that
    have completely registered for the game.
    @return string list of players.
*/
const _listPlayers = () => {
    var playerList = "Players: (" + playerCount + " of " + max_players + ")";
    for (var player_key in players) {
        var player = players[player_key];
        playerList += "\n";
        playerList += player.name;
    }
    playerList += "\n-------";
    console.log("Player list generated.");
    return playerList;
}

/*
    This function completes the entry process for the game.
    @param <Relay.Message> Details of player.
*/
const _namePlayer = (message) => {
    // Announce player
    if (playerCount < max_players) {
        playerCount += 1;
        var player = {
            number : message.from,
            name : message.body,
            cards : {},
            selected : 0,
            wins : 0
        }
        console.log("Adding [" + player.name + "] to players.");
        players[player.number] = player;

        // send announcement to other players.
        var msg = player.name + " has joined the game.\n" + _listPlayers();
        console.log(msg);
        _sendMessageToAllPlayers(msg);
        
        // Determine if this was the last player.
        if (playerCount == max_players) {
            if (!gameStarted) {
                _startGame();
            }
        }
    } else {
        // max number of players already reached.
        _sendMessageToNumber(message.from, "Sorry, but all player slots have been filled.\n");
    }
}

/*
    This function selects the blackcard for a given round.
*/
const _selectBlackCard = () => {
   var index = Math.floor(Math.random() * blackCards.numberOfCards) + 1;
   blackcard = blackCards.cards[index];
   console.log("Black Card Selected: " + blackcard.text);
}

/*
    This function deals the white cards for a given player.
    @param <playerObj> player Player for whom white card selection is required.
*/
const _selectWhiteCards = (player) => {
    for (i = 1; i <= numberOfWhiteCards; i++) {
        var validCard = false;
        while (!validCard) {
            // select a card.
            var index = Math.floor(Math.random() * whiteCards.numberOfCards) + 1;
            var card = whiteCards.cards[index];
            if (usedCards[index] == null) {
                usedCards[index] = card;
                console.log("Player (" + player.name + ") received card: " + card.text);
                player.cards[i] = card;
                validCard = true;
            }
        }
    }
}

/*
    This method initializes the game.
*/
const _initializeGame = () => {
    // Clear Waitingroom.
    console.log("Clearing waiting room.");
    waitingRoom = {};
    roundIndex = 0;
}

/*
    This method starts the game.
*/
const _startGame = () => {
    console.log("Starting game...");
    gameState = "STARTED";

    _initializeGame();
    _sendMessageToAllPlayers("====== GAME HAS BEGUN ======");
    _startRound();
}

/*
    This method initializes the round.
*/
const _initializeRound = () => {

    // reset judge if necessary
    judge = {};
    judgeSelectionCount = 0;
    judgeSelections = {};
    if (judgeIndex == max_players) {
        judgeIndex = 0;
    }

    // reset player cards
    blackcard = {};
    usedCards = {};
    for (var player_key in players) {
        var player = players[player_key];
        player.cards = {};
    }

    roundIndex += 1;
}

/*
    This method starts the round.
*/
const _startRound = () => {
    _initializeRound();

    console.log("Starting Round [" + roundIndex + "]... ");
    gameState = "ROUND_IN_PROGRESS";

    // pick a judge
    judgeIndex += 1;
    var judge_count = 1;
    for (var player_key in players) {
        var player = players[player_key];
        if (judge_count == judgeIndex) {
            // found our judge
            judge = player;
        }
        judge_count += 1;
    }

    console.log("Player (" + judge.name + ") has been selected as judge for this round.");
    // select black card
    _selectBlackCard();

    // deal white cards
    for (var player_key in players) {
        var player = players[player_key];
        player.selected = 0;
        if (player.number != judge.number) {
            console.log("Selecting white cards for: " + player.name);
            _selectWhiteCards(player);
        }
    }

    // send messages
        var roundMessage = "-=-=[ Round: " + roundIndex + " ]=-=-\n";
        var blkCardMessage = "Your blackcard is:\n" + blackcard.text + "\n\n";
        // send messages to players
        for (var player_key in players) {
            var player = players[player_key];
            if (player.number != judge.number) {
                var whiteCardMessage = "Your White Cards are:\n";
                var selectMessage = "\nSelect which card to use.";
                // Add white cards to message here.
                for (var card_key in player.cards) {
                    var card = player.cards[card_key];
                    whiteCardMessage += ("[" + card_key + "] - " + card.text + "\n");
                }
                _sendMessageToPlayer(player, roundMessage + blkCardMessage + whiteCardMessage + selectMessage);
            } else {
                // Send message to judge.
                _sendMessageToPlayer(player, roundMessage + "You have been selected as Judge for this round!\n" + 
                             blkCardMessage + "Please wait for players to make selections.");
            }
        }
}

/*
    This method returns a string with a complete list of winners.
    @return string list of winners.
*/
const _listWinners = () => {
    var winners = "Winner(s) - Total Wins: " + topWinner.wins + "\n";
    winners += topWinner.name;
    for (var tied_key in tiedPlayers) {
        var player = tiedPlayers[tied_key];
        winners += ("\n" + player.name);
    }
    return winners;
}

/*
    This method performs all actions upon completion of a round of play.
    If this is the last round of play, it will additionally, determine the winner(s)
    and perform the required actions to notify the winner.
*/
const _completeRound = () => {
    console.log("Completing Round...");
    gameState = "ROUND_COMPLETE";

    // determine winner
    var winner = judge.selected.player;
    winner.wins += 1;

    var msg = "-=-=[ Round: " + roundIndex + " Complete ]=-=-\nWinner: " + winner.name;
    msg += "\nWinning Entry: " + judge.selected.card.text;

    // send messages to all players
    _sendMessageToAllPlayers(msg);

    // start new round
    if (roundIndex < numberOfRounds) {
        _startRound();
    } else {
        // Determine winner.
        topWinner = {};
        tiedPlayers = {};
        losers = {};
        for (var player_key in players) {
            var player = players[player_key];
            
            if (topWinner.name == null) {
                console.log(player.name + " is initial top winner.");
                topWinner = player;
            } else {
                if (player.wins > topWinner.wins) {
                    // new top winner.
                    console.log(player.name + " appears to have beaten " + topWinner.name);
                    losers[player.number] = topWinner;
                    //add tied players to losers.
                    for (var tied_key in tiedPlayers) {
                        losers[tied_key] = tiedPlayers[tied_key];
                    }
                    topWinner = player;
                    tiedPlayers = {};
                } else if (player.wins == topWinner.wins) {
                    console.log(player.name + " appears to have tied " + topWinner.name);
                    tiedPlayers[player.number] = player;
                } else {
                    console.log(player.name + " is just a loser.");
                    losers[player.number] = player;
                }
            }
        }

        var winCallMsg = "Hello from ClueCon! Congratulations " + topWinner.name + ".  You are the winner! " +
                         "Make certain you let your friends know they are a bunch of losers. ";
        for (var loser_key in losers) {   
            var index = Math.floor(Math.random() * loserMessages.numberOfMessages) + 1;
            var loser = losers[loser_key];
            winCallMsg += (loser.name + loserMessages.messages[index].text);
        }
        winCallMsg += " Goodbye!";
        console.log("Winning Message:\n" + winCallMsg);
        _callPlayerWithTTSMessage(topWinner, winCallMsg);
        // game over
        _sendMessageToAllPlayers("===========\n GAME OVER \n===========\n" + _listWinners() + 
                                 "\n==============\nThanks for playing.");
        // flush players
        players = {};
        playerCount = 0;
        gameState = "NOT_STARTED";
    }
}

//-----------------------------------------
// start it up.
// Create the SignalWire Consumer
const consumer = new RelayConsumer({
    project: projectID,
    token: apiToken,
    contexts: ['default'],
  
    // Process new inbound message
    onIncomingMessage: async (message) => {
      // initialize fromHost
      if (fromHost == "") {
          fromHost = message.to;
      }
      console.log('Received message', message.id, message.context);
      _processIncomingMessage(message);
    }
});

consumer.run()
