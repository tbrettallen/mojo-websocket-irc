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

    my $timer; 
    my $c = AnyEvent->condvar;
    my $irc = new AnyEvent::IRC::Client;
	
    app->secrets(['My very secret passphrase.']);
    app->log->debug( "client connected, connecting to $irc_server" );

    $client->{timeout} = 600;

    $client->on(finish => sub {
        app->log->debug( "client finished, dropping connection to irc server" );
        $irc->disconnect;
        return;
    });

    $client->on(message => sub {
        #app->log->debug("OnMessage: " . $_[1]);
        $irc->send_raw($_[1]);
    });

	$irc->reg_cb(registered => sub {
		my ($sender) = @_;
		
	});
	
	$irc->reg_cb(debug_recv => sub {
		my ($sender, $ircmsg) = @_;
		my $rawCommand;
		
		$rawCommand = sprintf('%s%s %s', 
									$ircmsg->{'prefix'} ? ":".$ircmsg->{'prefix'}." " : "", 
									$ircmsg->{'command'},  
									$ircmsg->{'params'} ? join(' ', @{ $ircmsg->{'params'} }) : "");

		app->log->debug("OnRecv: $rawCommand");
		$client->send($rawCommand."\n");
	});
	
	$irc->reg_cb(debug_send => sub {
		my ($sender, $command, @params) = @_;
		my $rawCommand = "$command " . (@params ? join(' ', @params) : "");
		app->log->debug("OnSend: $rawCommand");
	});

    $irc->connect("irc.hackthissite.org", 6667);
	
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
    <title>Mojo Websocket Demo - ExtJS IRC Client</title>

    <link rel="stylesheet" type="text/css" href="js/ext-3.2-rc/resources/css/ext-all.css" />
    <script type="text/javascript" src="js/ext-3.2-rc/adapter/ext/ext-base-debug.js"></script>
    <script type="text/javascript" src="js/ext-3.2-rc/ext-all-debug.js"></script>


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
        Ext.BLANK_IMAGE_URL = 'js/ext-3.2-rc/resources/images/default/s.gif';
    </script>

    <script type="text/javascript" src="js/filter/Filter.js"></script>
    <script type="text/javascript" src="js/filter/Line.js"></script>
    <script type="text/javascript" src="js/filter/IRC.js"></script>
    <link rel="stylesheet" type="text/css" href="css/irc.css" />
    <script type="text/javascript" src="js/irc-client.js"></script>
    <script type="text/javascript">
		// This doesn't fix the problem discused below. Commented out in case it's useful later.
		//var win;
		//window.onresize = function(event) {
		//	if (!win)
		//		return;
		//	win.width = window.innerWidth;
		//	win.height = window.innerHeight;
		//	win.doLayout();
		//};
		
        Ext.onReady(function() {
			var win = Ext.create({
				title: 'Mojo WebSocket Demo - ExtJS IRC Client',
				xtype: 'irc-client',
				renderTo: 'irc-panel',
				width: window.innerWidth, // Can't figure out how to auto-resize this.
				height: window.innerHeight,
				x: 0,
				y: 0,
				//layout: 'fit', // This doesn't appear to do anything.
				wsUrl: '<%= $url  %>'
			});
            win.show();
        });
    </script>
</head>
<body>
    <h2>Mojo WebSocket Demo - ExtJS IRC Client</h2>
    <div id="irc-panel"></div>
</body>
</html>

