/**
 * Created with JetBrains WebStorm.
 * User: Reshef
 * Date: 10/15/13
 * Time: 10:01 AM
 * To change this template use File | Settings | File Templates.
 */
var SQS = require('aws-sqs');
var gm = require('googlemaps');
var util = require('util');
var _ = require('underscore');
var $ = require('jquery');

var twClient = require('twilio')('ACe467a34aae376d74d36a9c990feb8f39', '859a9721ebd3eb456a9cf9fc3144183e');

var getWiki = function(title, phone, callback) {
    console.log('Getting wiki info on: %s', title);
    $.getJSON("http://en.wikipedia.org/w/api.php?action=parse&page=" +title + "&prop=text&section=0&format=json&callback=?", function (data) {
        console.log('wiki data', data);
        if (data.error){
            callback('Sorry, Could not find the wikipedia definition of:' + title,phone);
        }else {
            for (text in data.parse.text) {
                var text = data.parse.text[text].split("<p>");
                var pText = "";
                for (p in text) {
                    //Remove html comment
                    text[p] = text[p].split("<!--");
                    if (text[p].length > 1) {
                        text[p][0] = text[p][0].split(/\r\n|\r|\n/);
                        text[p][0] = text[p][0][0];
                        text[p][0] += "</p> ";
                    }
                    text[p] = text[p][0];

                    //Construct a string from paragraphs
                    if (text[p].indexOf("</p>") == text[p].length - 5) {
                        var htmlStrip = text[p].replace(/<(?:.|\n)*?>/gm, '') //Remove HTML
                        var splitNewline = htmlStrip.split(/\r\n|\r|\n/); //Split on newlines
                        for (newline in splitNewline) {
                            if (splitNewline[newline].substring(0, 11) != "Cite error:") {
                                pText += splitNewline[newline];
                                pText += "\n";
                            }
                        }
                    }
                }

                pText = pText.substring(0, pText.length - 2); //Remove extra newline
                pText = pText.replace(/\[\d+\]/g, ""); //Remove reference tags (e.x. [1], [4], etc)
                textOut = pText.split("\n"); //Remove extra information, save only first paragraph
                console.log('Got wiki results!');
                callback && callback(textOut[0], phone);
            }
        }
    })
};

var getDirections = function (from, to, phone, callback) {
    gm.directions(from, to, function (err,data) {
        directions = _.map(data.routes[0].legs[0].steps, function(step){
            return step.html_instructions.replace(/(<([^>[^>]+)>)/ig,"");
        });
        callback(directions.join(), phone);
    });
}

console.log('--------   AWS Hackathon - Siri for Dumbphones  -----------');

var sendSms = function(res, number){
    console.log('Sending SMS with %s', res);
    twClient.sendSms({
        to: number,
        from:'+14157277428',
        body:res.substring(0,159)
    }, function(error, message) {
        if (!error) {
            console.log('Success! The SID for this SMS message is:');
            console.log(message.sid);

            console.log('Message sent on:');
            console.log(message.dateCreated);
        }
        else {
            console.log('Oops! There was an error. %j', error);
        }
})};

var makeCall = function(res, phone) {
    console.log('Making a call with: %s', res);
    twClient.makeCall({
        to: phone,
        from: '+97243729129',
        url: 'http://ec2-50-19-8-30.compute-1.amazonaws.com:4567/twilioXML?text=' + encodeURIComponent(res)
    },
        function(err, responseData) {
            //executed when the call has been initiated.
            console.log("Call initiated! %s" + responseData.from); // outputs "+14506667788"

    })
}


var sqs = new SQS('AKIAI3RMIG7SXAHZHQIQ', 'NHuzI1Q5FwnN+AjOtMcnTXJ9cgx0T6iAL770yo2o');
setInterval(function(){
    sqs.receiveMessage('/545308976171/Calls', {
            'MaxNumberOfMessages':1,
            'VisibilityTimeout':43200
        },
        function(err, msgArr) {
            if (msgArr != null){
                var msg = JSON.parse(msgArr[0].Body).text;
                var phone = JSON.parse(msgArr[0].Body).phone;
                console.log('------------------------------------------');
                console.log('msg: %j', msg);
                var words = msg.split(' ');
                if (words[0].indexOf('direction') == 0){
                    console.log('directions from %s to %s', words[1], words[2]);
                    getDirections(words[1], words[2], phone, makeCall);
                }else {
                    console.log('wiki of %s', msg);
                    msg = msg.replace('.','');
                    getWiki(msg, phone, makeCall);

                }
            }
        });
}, 1000);

