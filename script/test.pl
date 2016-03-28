#!/usr/bin/perl

# Copyright (c) 2010, David Davis - http://xant.us/

# WebSocket Example 2 - irc client
# Powered by Mojo - http://mojolicious.org/ - http://github.com/kraih/mojo
# and web-socket-js - http://github.com/gimite/web-socket-js



use AnyEvent;
use AnyEvent::IRC::Client;
use Mojo::IOLoop;
use Mojo::Util;
use Mojolicious::Lite;
use Data::Dumper;

use strict;
use warnings;
use bytes;

# Connection list
my $c = {};

@ARGV = qw( daemon ) unless @ARGV;

my $irc_server = 'irc.hackthissite.org';
my $irc_port = 6667;

websocket '/' => sub {
    my $client = shift;

    app->secrets(['My very secret passphrase.']);
    app->log->debug( "client connected, connecting to $irc_server" );

    $client->send( "Connecting to $irc_server\n" );
    
    my $con = $c->{"$client"} = {
        buffer => ''
    };
    
    $client->{timeout} = 600;

    $client->on(finish => sub {
        app->log->debug( "client finished, dropping connection to irc server" );
        #$irc->disconnect;

        delete $c->{"$client"};
        return;
    });

    $client->on(message => sub {
        app->log->debug("OnMessage: " . $_[1]);
        
        $con->{buffer} ||= '';
        $con->{buffer} .= $_[1]; # chunk

        #$irc->write( $con->{irc} => delete $con->{buffer} )
        #    if $con->{irc} && length $con->{buffer};
    });
	
	my $log_chan = '#mojo';
    my $timer; 
    my $c = AnyEvent->condvar;
    my $irc = new AnyEvent::IRC::Client;

	$irc->reg_cb(registered => sub {
		my ($irc) = @_;
		
		$client->send("Connected to $irc_server");
	});
	
	$irc->reg_cb(debug_recv => sub {
		my ($irc, $ircmsg) = @_;
		my $rawCommand = $ircmsg->{'prefix'}.' '.$ircmsg->{'command'}.' '.join(' ', @{ $ircmsg->{'params'} });
		
		app->log->debug($rawCommand);
		$client->send($rawCommand."\n");
	});
	
    $irc->reg_cb( join => sub {
        my ($irc, $nick, $channel, $is_myself) = @_; 
        if ($is_myself) {
			$client->write("Joined $channel");
			#$irc->send_chan( $channel, PRIVMSG => ($channel, 'my information') );
			#$timer = AnyEvent->timer ( 
			#     after => 1,
			#     cb => sub {
			#         undef $timer;
			#         $irc->disconnect('done');
			#     });
        }
    });

    $irc->connect("irc.hackthissite.org", 6667, { nick => "testMojo" } );
    $irc->send_srv( JOIN => ($log_chan) );
	
	#Mojo::IOLoop->start;
	
    return;
};

get '/' => 'index';

# see script/flash-policy-server
print "Chrome users: connect to 127.0.0.1 instead of localhost\n";
print "Remember, you need to also run script/flash-policy-server as root for this to work on non WebSocket browsers...\n";

app->start;

1;

__DATA__

@@ index.html.ep
% my $url = $self->req->url->to_abs->scheme( $self->req->is_secure ? 'wss' : 'ws' )->path( '/' );
<!doctype html>
<html>
<head>
    <title>Mojo Websocket Demo - Simple IRC Client</title>

    <script type="text/javascript">
        // only load the flash fallback when needed
        if ( !( 'WebSocket' in window ) ) {
            document.write([
                '<scr'+'ipt type="text/javascript" src="web-socket-js/swfobject.js"></scr'+'ipt>',
                '<scr'+'ipt type="text/javascript" src="web-socket-js/FABridge.js"></scr'+'ipt>',
                '<scr'+'ipt type="text/javascript" src="web-socket-js/web_socket.js"></scr'+'ipt>'
            ].join(''));
        }
    </script>
    <script type="text/javascript">
        if ( WebSocket.__initialize ) {
            // Set URL of your WebSocketMain.swf here:
            WebSocket.__swfLocation = 'web-socket-js/WebSocketMain.swf';
        }

        // example derived from web-socket-js/sample.html
        var ws, input, log, btn, timer;
        var ch = '#mojo';

        function  wsconnect() {
            btn.innerHTML = 'Disconnect';
            output( 'websocket connecting...\n' );

            ws = new WebSocket( '<%= $url %>' );

            ws.onopen = function() {
                output( 'websocket connected\n' );
                ws.send( 'JOIN ' + ch +'\n' );
                output( 'send: JOIN ' + ch + '\n' );
            };
            ws.onmessage = function(e) {
                if ( e.data.match( /^PING (\S*)/i ) ) {
                    ws.send( 'PONG ' + RegExp.$1 + '\n' );
                    output( '*PING*PONG*\n' );
                } else {
                    output( e.data );
                }
            };
            ws.onclose = function() {
                btn.innerHTML = 'Connect';
                output( 'websocket disconnected\n' );
            };
            if ( timer )
                clearTimeout( timer );
            timer = setInterval( ping, 1000 );
        }

        function ping() {
            // just to keep the websocket alive
            if ( ws && ws.readyState == WebSocket.OPEN )
                ws.send( '' );
        }

        function onSubmit() {
            if ( input.value == '' )
                return;
            if ( input.value.match( /^\/nick (.*)/i ) ) {
                ws.send( 'nick ' + RegExp.$1 + '\n' );
            } else if ( input.value.match( /^\/quote (.*)/i ) ) {
                ws.send( RegExp.$1 + '\n' );
                output( 'raw send: ' + RegExp.$1 + '\n' );
            } else if ( input.value.match( /^\/quit(.*)/i ) ) {
                ws.send( 'quit :' + (RegExp.$1 || 'Shagadelic') + '\n' );
            } else if ( input.value.match( /^\/join (.*)/i ) ) {
                ws.send( 'part ' + ch + '\n' );
                output( 'send: part ' + ch + '\n' );
                ws.send( 'join ' + RegExp.$1 + '\n' );
                output( 'send: join ' + RegExp.$1 + '\n' );
                ch = RegExp.$1;
            } else {
                ws.send( 'privmsg ' + ch + ' :' + input.value + '\n' );
                output( 'send: ' + input.value + '\n' );
            }
            input.value = '';
            try{ input.focus(); } catch(e) { };
        }

        function onCloseClick() {
            if ( btn.innerHTML == 'Disconnect' )
                ws.close();
            else
                wsconnect();
        }

        function output(str) {
            var escaped = str.replace( /&/, '&amp;', 'g' ).replace( /</, '&lt;', 'g' ).
                replace( />/, '&gt;', 'g' ).replace( /"/, '&quot;', 'g' );
            log.innerHTML = log.innerHTML + escaped;
            log.scrollTop = log.scrollHeight;
        }

        function init() {
            input = document.getElementById( 'input' );
            log = document.getElementById( 'log' );
            btn = document.getElementById( 'btn' );
            wsconnect();
        }

        window.onload = init;
    </script>
</head>
<body>
    <h2>Mojo WebSocket Demo - Simple IRC Client</h2>
    <pre id="log" style="height:400px; width: 99%; overflow: auto;"></pre>
    <form onsubmit="onSubmit(); return false;">
        <input type="text" id="input" style="width:400px">
        <input type="submit" value="Send">
        <button id="btn" onclick="onCloseClick(); return false;">Connect</button>
    </form>
</body>
</html>