
Ext.ns( 'Ext.ux.IRCClient' );

Ext.ux.IRCClient = Ext.extend( Ext.Window, {
    layout: 'border',
    //animCollapse: false,

    initComponent: function() {
        this.items = [{
            xtype: 'tabpanel',
            id: 'irc-tab-panel',
            activeTab: 0,
            region: 'center',
            items: [{
                xtype: 'panel',
                id: this.id + '-status',
                title: 'Status',
                plain: true,
                autoScroll: true,
                bodyCfg: {
                    id: this.id + '-status-el'
                },
                listeners: {
                    show: this.afterShowTab,
                    scope: this
                }
            }]
        }, {
            xtype: 'panel',
            region: 'south',
            width: 100,
            split: true,
            height: 50,
            layout: 'fit',
            plain: true,
            bodyStyle: 'border-color:#ccc',
            bodyCfg: {
                id: this.id + '-input',
                tag: 'textarea'
            },
            keys: {
                key: 13,
                stopEvent: true,
                fn: this.ircInput,
                scope: this
            }
        }];

		this.ircDefaultChannel = "#mojo";
        this.ircNickname = Ext.state.Manager.get( 'irc-client-nickname', 'MojoGuest' + parseInt( Math.random()*1000 ) );
		
        Ext.ux.IRCClient.superclass.initComponent.call(this);
    },

    onRender: function() {
        Ext.ux.IRCClient.superclass.onRender.apply( this, arguments );

        this.channelIds = [];

        this.wsfilter = new Ext.ux.Sprocket.Filter.Stackable({ filters: [ 'Line', 'IRC' ] });

        this.on( 'afterrender', this.onAfterRender, this, { single: true } );
    },

    onAfterRender: function() {
        this.inputEl = Ext.get( this.id + '-input' );
        this.connect();
    },

    afterShowTab: function(tab) {
        var el = document.getElementById( tab.id + '-el' );
        if ( el )
            el.scrollTop = el.scrollHeight;
    },

    afterRemoveTab: function(tab) {
//        console.log('removing tab id '+tab.id+' from channelIds');
        this.channelIds.remove( tab.id );
        if ( tab.channelName ) {
            this.addLine( '<span style="color:green;">Parting '+Ext.util.Format.htmlEncode( tab.id )+'</span>', this.id + '-status' );
            this.socket.send( 'PART '+tab.channelName+'\n' );
        }
    },

    connect: function( ev ) {
        if ( this.socket )
            this.un( 'close', this.socket.close );
		else
			this.keepAlive(this);

        this.socket = new WebSocket( this.wsUrl );
        this.socket.onmessage = this.received.createDelegate( this );
        this.socket.onopen = this.connected.createDelegate( this );
        this.socket.onclose = this.disconnected.createDelegate( this );

        this.on( 'close', this.socket.close );
    },
	
	keepAlive: function ( _this ) {
		setTimeout(function () {
			if ( _this.socket !== undefined && _this.socket.readyState == WebSocket.OPEN ) {
					_this.socket.send( '' );
			}
			_this.keepAlive(_this);
		}, 5000);
	},

    _received: function( ev ) {
        var data = this.wsfilter.get( ev.data );
        for ( var i = 0, len = data.length; i < len; i++ ) {
            var o = data[ i ];
            if ( o.name == 'notice' )
                this.addLine( '<span style="color:blue;">' + o.args.join( ' ' ) + '</span>' );
            else if ( o.name == 'ping' )
                this.socket.send( 'PONG ' + o.args[ 0 ] + '\n' ); 
            else
                this.addLine( '<pre wrap="auto">' + Ext.encode( o ) + '</pre>' );
        }
    },

    received: function( ev ) {
        var data = this.wsfilter.get( ev.data );
        for ( var i = 0, len = data.length; i < len; i++ ) {
            //try {
                this.process( data[ i ] );
            //} catch(e) {
            //    console.warn( e.message );
           //     this.addLine( '<span style="color:red;"><b>Error while processing data:</b> ' + Ext.util.Format.htmlEncode( e.message ) + '</span>' );
            //};
        }
    },

    process: function( o ) {
        //console.log(o);
        switch ( o.name ) {
            case 'notice':
                this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( o.args.join( ' ' ) ) + '</span>' );
                break;
            case 'ping':
                this.addLine( '<span style="color:blue;">PING * PONG</span>', this.id + '-status' );
                this.socket.send( 'PONG ' + o.args[ 0 ] + '\r\n' ); 
                break;
            case 'msg':
				var sender = o.args[0].split('!')[0];
                // {"name":"msg","args":["xantus[]!~xantus@207.7.148.204",[["xantus-web"]],"hi"]}
				if (sender == "IRC") {
					//this.addLine( '<pre wrap="auto">' + Ext.util.Format.htmlEncode( o.args[2] ) + '</pre>', this.id + '-status' );
					break;
				}
                var msg = Ext.util.Format.htmlEncode( o.args[ 2 ] );
                msg = msg.replace( /(https?:\/\/\S*)/gi, '<a href="$1" target="_blank">$1</a>' );
                this.addLine( '<span wrap="auto">&lt;' + Ext.util.Format.htmlEncode( sender ) + '&gt; ' + msg + '</span>', o.args[0].split('!')[0] );
                break;
            case 'public':
                var msg = Ext.util.Format.htmlEncode( o.args[ 2 ] );
                msg = msg.replace( /(https?:\/\/\S*)/gi, '<a href="$1" target="_blank">$1</a>' );
                var chan = o.args[ 1 ][ 0 ][ 0 ];
                if ( msg.match( /^\u0001ACTION / ) ) {
                    msg = msg.replace( /^\u0001ACTION /, '' );
                    msg = msg.replace( /\u0001$/, '' );
                    var nick = o.args[ 0 ].split('!')[0];
                    this.addLine( '<span style="color:green;">* ' + Ext.util.Format.htmlEncode( nick + ' ' + msg ) + ' </span>', chan );
                } else {
//                    this.addLine( '<pre wrap="auto">' + Ext.util.Format.htmlEncode( Ext.encode( o ) ) + '</pre>', this.id + '-status' );
                    this.addLine( '<span><strong>&lt;' + o.args[ 0 ].split('!')[0] + '&gt;</strong> ' + msg + '</span>', chan );
                }
                break;
            case 'join':
                var nick = o.args[0].split('!')[0];
                if ( nick == this.ircNickname ) {
                    this.addTab( o.args[1], true );
                } else {
                    this.userJoinedChannel( nick, o.args[ 1 ]);
                }
                break;
            case '443':
                // nickname in use
                this.addLine( '<span style="color:red;">Nickname in use, use /nick &gt;nickname&lt; to change it</span>', tab );
                break;
            case '432':
                // error, bad nickname
                // bad nickname {"name":"432","args":["magnet.llarian.net","\"xantus-web3\" :Erroneous Nickname"]}
                this.addLine( '<span style="color:red;">Error:'+ Ext.util.Format.htmlEncode( o.args[1] ) +'</span>', tab );
                break;
            case 'part':
                var nick = o.args[0].split('!')[0];
                this.userPartedChannel( nick, o.args[ 1 ] );
                break;
            case 'quit':
                var nick = o.args[0].split('!')[0];
                this.userQuit( nick, o.args[1] );
                break;
            case 'mode':
                // {"name":"mode","args":["xantus-web3!~sprocket@cpe-76-94-111-78.socal.res.rr.com","xantus-web3",["+i"]]}
                // {"name":"mode","args":["BinGOs!bitbucket@gumbybrain.com","#poe",["+v","khisanth_"]]}
                // {"name":"mode","args":["GumbyNET2!~gumby@jkon.net","#poe",["+o","xantus[]"]]}
                var nick = o.args[0].split('!')[0];
                if ( nick == this.ircNickname ) {
                    this.addLine( '<span style="color:blue;">Mode change <span style="color:black;">' + Ext.util.Format.htmlEncode( o.args[2].join(' ') ) + '</span> for user ' + Ext.util.Format.htmlEncode( o.args[1] ) + '</span>', this.id + '-status' );
                } else {
                    this.addLine( '<span style="color:blue;">Mode <span style="color:black;">' + Ext.util.Format.htmlEncode( o.args[2].join(' ') ) + '</span> by ' + Ext.util.Format.htmlEncode( nick ) + '</span>', o.args[1] );
					var modifier = o.args[2][0].substr(0,1);
					var mode = o.args[2][0].substr(1);
					
					for (var i = 0, len = mode.length; i < len; i++) {
						switch (mode[i])
						{
							case 'q':
								if (modifier == '+')
									this.userChannelModeChanged(o.args[2][1], o.args[1], 0, "owner");
								else
									this.userChannelModeChanged(o.args[2][1], o.args[1], 5, "normal");
								break;
							case 'a':
								if (modifier == '+')
									this.userChannelModeChanged(o.args[2][1], o.args[1], 1, "prot");
								else
									this.userChannelModeChanged(o.args[2][1], o.args[1], 5, "normal");
								break;
							case 'o':
								if (modifier == '+')
									this.userChannelModeChanged(o.args[2][1], o.args[1], 2, "op");
								else
									this.userChannelModeChanged(o.args[2][1], o.args[1], 5, "normal");
								break;
							case 'h':
								if (modifier == '+')
									this.userChannelModeChanged(o.args[2][1], o.args[1], 3, "halfop");
								else
									this.userChannelModeChanged(o.args[2][1], o.args[1], 5, "normal");
								break;
							case 'v':
								if (modifier == '+')
									this.userChannelModeChanged(o.args[2][1], o.args[1], 4, "voice");
								else
									this.userChannelModeChanged(o.args[2][1], o.args[1], 5, "normal");
								break;
						}
					}
                }
                break;
            case '332':
                // channel title
				var args = o.args[1].split( ' ' );
                var chan = args.shift();
                this.addLine( '<span style="color:blue;">Channel title: </span><span wrap="auto">' + args.join(' ') + '</span>', chan );
                break;
            case 'kick':
                var nick = o.args[0].split('!')[0];
                if ( o.args[2] == this.ircNickname ) {
                    // {"name":"kick","args":["xantus[]!~xantus@207.7.148.204","#poe","xantus-web","test"]}
                    this.addLine( '<span style="color:red;">You were kicked from ' + Ext.util.Format.htmlEncode( o.args[1] ) + ' by '+ Ext.util.Format.htmlEncode( nick ) +' Reason: '+ Ext.util.Format.htmlEncode( o.args[3] ) + '</span>', o.args[1] );
//                    this.removeTab( o.args[1] );
                } else {
                    // kicked
                    this.userPartedChannel( o.args[2], o.args[1], nick, o.args[3] );
                }
                break;
            case 'nick':
                var nick = o.args[0].split('!')[0];
                this.userChangedNicks( nick, o.args[ 1 ] );
                break;
            case '353':
//                this.addLine( '<pre wrap="auto">' + Ext.util.Format.htmlEncode( Ext.encode( o ) ) + '</pre>', this.id + '-status' );
                var members = o.args[1].trim().split(' ');
				var chanType = members.shift();
				var channel = members.shift();
				
                var tabid = this.addTab( channel );
				
                for ( var i = 0, len = members.length; i < len; i++ ) {
                    var type = members[ i ].substr( 0, 1 );
                    var name = members[ i ].split('!')[0]
								.replace('~', '')
								.replace('&', '')
								.replace('@', '')
								.replace('%', '')
								.replace('+', '');
					
                    switch ( type ) {
						case '~': // owner
							this.userChannelModeChanged(name, channel, 0, 'owner');
							break;
						case '&': // protected
							this.userChannelModeChanged(name, channel, 1, 'prot');
							break;
                        case '@': // op
							this.userChannelModeChanged(name, channel, 2, 'op');
                            break;
                        case '%': // half-op
							this.userChannelModeChanged(name, channel, 3, 'halfop');
                            break;
                        case '+': // voice
							this.userChannelModeChanged(name, channel, 4, 'voice');
                            break;
                        default:
							this.userChannelModeChanged(name, channel, 5, 'normal');
                            break;
                    }
                }
				
//                    this.addLine( '<span style="color:blue;">Channel members:</span><span wrap="auto">' + members.join(', ') + '</span>', o.args[1].substr( 0, idx ) );
                break;
            case '376':
                this.addLine( '<span style="color:green;">Trying to join '+Ext.util.Format.htmlEncode( this.ircTestChannel )+'</span>', this.id + '-status' );
                this.socket.send( 'JOIN '+this.ircDefaultChannel+'\n' );
                break;
			default:
				o.args.shift();
                this.addLine( '<pre wrap="auto">' + Ext.util.Format.htmlEncode( o.args.join(' ') ) + '</pre>', this.id + '-status' );
				break;
        }
    },

    userChannelModeChanged: function( nick, chan, childNodeIndex, modeType ) {
        if ( !chan )
            return;
        var cid = chan.replace(/[^A-Z0-9-_]/gi, '');
        for ( var i = 0, len = this.channelIds.length; i < len; i++ ) {
            if ( cid ) {
                if ( cid != this.channelIds[ i ] )
                    continue;
            }
			
            var tree = Ext.getCmp( 'user-tree-' + this.channelIds[ i ] );
			
            // would be odd, shouldn't happen
            if ( !tree )
                continue;
			
			// For some reason findChild doesn't work here, but lastChild does o_O.
			var group = tree.root.childNodes[childNodeIndex];
			
			if (!group)
				continue;
			
			for ( var x = 0, len2 = tree.root.childNodes.length; x < len2; x++ ) {
				var child = tree.root.childNodes[x].findChild( 'text', nick );
			
				if ( child )
					child.parentNode.removeChild(child);
			}
			
            group.appendChild({
                text: nick,
                iconCls: 'irc-user-' + modeType,
                leaf: true
            });
        }
    },

    userJoinedChannel: function( nick, chan ) {
        if ( !chan )
            return;
        var cid = chan.replace(/[^A-Z0-9-_]/gi, '');
        for ( var i = 0, len = this.channelIds.length; i < len; i++ ) {
            if ( cid ) {
                if ( cid != this.channelIds[ i ] )
                    continue;
            }
            this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( nick ) + ' has joined ' + Ext.util.Format.htmlEncode( chan ) + '</span>', this.channelIds[ i ] );
            var tree = Ext.getCmp( 'user-tree-' + this.channelIds[ i ] );
            // would be odd, shouldn't happen
            if ( !tree )
                continue;
			
			// For some reason findChild doesn't work here, but lastChild does o_O.
			var normalGroup = tree.root.lastChild;
			
			if (!normalGroup)
				continue;
			
			for ( var x = 0, len2 = tree.root.childNodes.length; x < len2; x++ ) {
				var child = tree.root.childNodes[x].findChild( 'text', nick );
			
				if ( child )
					child.parentNode.removeChild(child);
			}
			
            normalGroup.appendChild({
                text: nick,
                iconCls: 'irc-user-normal',
                leaf: true
            });
        }
    },

    userPartedChannel: function( nick, chan, kickedby, reason ) {
        var cid;
        if ( chan )
            cid = chan.replace(/[^A-Z0-9-_]/gi, '');
        for ( var i = 0, len = this.channelIds.length; i < len; i++ ) {
            if ( cid ) {
                if ( cid != this.channelIds[ i ] )
                    continue;
            }
            if ( kickedby ) {
                this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( nick ) + ' was kicked from ' + Ext.util.Format.htmlEncode( chan || '' ) + ' by ' + Ext.util.Format.htmlEncode( kickedby ) + ' Reason: '+ Ext.util.Format.htmlEncode( reason ) +'</span>', this.channelIds[ i ] );
            } else {
                this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( nick ) + ' has left ' + Ext.util.Format.htmlEncode( chan || '' ) + '</span>', this.channelIds[ i ] );
            }
            var tree = Ext.getCmp( 'user-tree-' + this.channelIds[ i ] );
            // would be odd, shouldn't happen
            if ( !tree )
                continue;
			
            for ( var x = 0, len2 = tree.root.childNodes.length; x < len2; x++ ) {
				var child = tree.root.childNodes[x].findChild( 'text', nick );
			
				if (!child)
					continue;
				
				child.parentNode.removeChild( child );
				break;
			}
        }
    },

    userQuit: function( nick, reason ) {
        for ( var i = 0, len = this.channelIds.length; i < len; i++ ) {
            var tree = Ext.getCmp( 'user-tree-' + this.channelIds[ i ] );
            // would be odd, shouldn't happen
            if ( !tree )
                continue;
			
			for ( var x = 0, len2 = tree.root.childNodes.length; x < len2; x++ ) {
				var child = tree.root.childNodes[x].findChild( 'text', nick );
			
				if (!child)
					continue;
				
				this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( nick ) + ' has quit: ' + Ext.util.Format.htmlEncode( reason ) + '</span>', this.channelIds[ i ] );
				child.parentNode.removeChild( child );
				break;
			}
        }
    },

    userChangedNicks: function( nick1, nick2 ) {
        for ( var i = 0, len = this.channelIds.length; i < len; i++ ) {
            var tree = Ext.getCmp( 'user-tree-' + this.channelIds[ i ] );
            // would be odd, shouldn't happen
            if ( !tree )
                continue;
			
			for ( var x = 0, len2 = tree.root.childNodes.length; x < len2; x++ ) {
				var child = tree.root.childNodes[x].findChild( 'text', nick1 );
			
				if (!child)
					continue;
				
				this.addLine( '<span style="color:blue;">' + Ext.util.Format.htmlEncode( nick1 ) + ' is now known as <strong>' + Ext.util.Format.htmlEncode( nick2 ) + '</strong></span>', this.channelIds[ i ] );
				child.setText( nick2 );
				break;
			}
        }
    },


    clean: function( txt ) {
//        if ( !( txt instanceof String ) )
//            return '';
        return txt.replace( /[^A-Z0-9-_#\[\]]/gi, '' );
    },


    promptNickname: function( btn, nick ) {
        if ( btn != 'ok' )
            return;
        nick = this.clean( nick );
        if ( nick == '' )
            return;

        Ext.state.Manager.set( this.moduleId+'-nickname', this.ircNickname = nick );
        this.addLine( '<span style="color:blue;">Your IRC nickname is set to "'+Ext.util.Format.htmlEncode(this.ircNickname)+'"</span>' );

        if ( this.socket.readyState == WebSocket.OPEN )
            this.socket.send( 'NICK :' + nick + '\n' );
    },
	
	initializeNickname: function (btn, nick) {
		this.promptNickname(btn, nick);
		this.socket.send('USER mojo * 0 mojo' + "\n");
	},

    connected: function( ev ) {
//        console.log('connected');
		Ext.Msg.prompt( 'Nickname', 'Please enter a nick name:', this.initializeNickname, this );
    },

    disconnected: function( ev ) {
//        console.log('disconnected');
        this.addLine( '<span style="color:red;">Disconnected.</span>' );
    },


    ircInput: function() {
		var tabObj = Ext.getCmp('irc-tab-panel').getActiveTab();
        var tab = tabObj.getId();

        var i = this.inputEl.dom.value;
        this.inputEl.dom.value = '';

        if ( this.socket && this.socket.readyState == WebSocket.CONNECTING )
            return this.addLine( '<span style="color:red">Connecting...please wait</span>' );

        var m;

        if ( !this.socket || this.socket.readyState != WebSocket.OPEN ) {
            if ( i.match( /^\/connect/i ) )
                return this.connect();

            if ( ( m = i.match( /^\/nick\s?(.*)/i ) ) ) {
                var nick = this.clean( m[ 1 ] );
                if ( nick == '' )
                    return Ext.Msg.prompt( 'Nickname', 'Please enter a nick name:', this.promptNickname, this );
//                    return this.addLine( '<span style="color:red;">Bad nickname</span>', tab );
                Ext.state.Manager.set( this.moduleId+'-nickname', this.ircNickname = nick );
                return this.addLine( '<span style="color:blue;">Nickname set to </span><span>'+Ext.util.Format.htmlEncode( nick )+'</span>', tab );
            }

            return this.addLine( '<span style="color:red">Not connected, use the command /connect to connect first</span>' );
        }

        if ( ( m = i.match( /^\/join (.*)/i ) ) ) {
//            this.addTab( m[ 1 ], true );
            this.addLine( '<span style="color:green;">Trying to join '+Ext.util.Format.htmlEncode( m[ 1 ] )+'</span>', tab );
            this.socket.send( 'JOIN '+m[ 1 ]+'\n' );
        } else if ( ( m = i.match( /^\/part (.*)/i ) ) ) {
            this.addLine( '<span style="color:green;">Parting '+Ext.util.Format.htmlEncode( m[ 1 ] )+'</span>', tab );
            this.socket.send( 'PART '+m[ 1 ]+'\n' );
        } else if ( ( m = i.match( /^\/msg (\S+) (.*)/i ) ) ) {
            this.addLine( '<span>&lt;' + Ext.util.Format.htmlEncode( this.ircNickname ) + '&gt; '+ Ext.util.Format.htmlEncode( m[2] )+'</span>', Ext.util.Format.htmlEncode( m[ 1 ] ) );
            this.socket.send( 'PRIVMSG '+m[ 1 ]+' :'+m[ 2 ]+'\n' );
        } else if ( ( m = i.match( /^\/quit\s?(.*)?/i ) ) ) {
            Ext.getCmp('irc-tab-panel').activate( this.id + '-status' );
            this.addLine( '<span style="color:green;">Quitting...</span>', tab );
            this.socket.send( m[ 1 ] ? 'QUIT :'+m[ 1 ] : 'QUIT\n' );
            // show the status tab
        } else if ( ( m = i.match( /^\/quote (.*)/i ) ) ) {
            this.addLine( '<span style="color:green;">[sent] '+Ext.util.Format.htmlEncode( m[ 1 ] )+'</span>', tab );
            this.socket.send( m[ 1 ] + '\n' );
        } else if ( ( m = i.match( /^\/nick\s?(.*)/i ) ) ) {
            var nick = this.clean( m[ 1 ] );
            if ( nick == '' )
                return Ext.Msg.prompt( 'Nickname', 'Please enter a nick name:', this.promptNickname, this );
//                return this.addLine( '<span style="color:red;">Bad nickname</span>', tab );
            this.socket.send( 'NICK :' + nick + '\n' );
            Ext.state.Manager.set( this.moduleId+'-nickname', this.ircNickname = nick );
        } else {
            if ( tab == this.id + '-status' ) {
                this.addLine( '<span>No channel selected, select a tab first or use /quote to send raw commands</span>' );
            } else {
                this.socket.send( 'PRIVMSG '+tabObj.channelName+' :'+i+'\n' );
                this.addLine( '<span>&lt;' + Ext.util.Format.htmlEncode( this.ircNickname ) + '&gt; '+ Ext.util.Format.htmlEncode( i )+'</span>', tab );
            }
        }
    },


    addLine: function( txt, channel ) {
        if ( channel == this.id + '-status' )
            channel = undefined;
        var el = document.getElementById( ( !Ext.isEmpty( channel ) ? this.addTab( channel ) : this.id + '-status' ) + '-el' );
        if ( !el )
            return this.addLine.defer( 200, this, [ txt, channel ] );

        var p = document.createElement( "div" );
        /* XXX ugly, use a template */
        p.style.paddingLeft = "7px";
        p.style.padding = '1px';
        p.style.wrap = 'auto';
        p.innerHTML = txt;
        el.appendChild( p );
        el.scrollTop = el.scrollHeight;
    },

    removeTab: function( channel ) {
        var id = channel.replace(/[^A-Z0-9-_]/gi, '');
        var tab = Ext.getCmp('irc-tab-panel').getItem( id );
        if ( tab )
            tab.remove();
    },

    addTab: function( channel, act ) {
        var id = !channel ? Ext.id() : channel.replace(/[^A-Z0-9-_]/gi, '');
        if ( Ext.getCmp('irc-tab-panel').getItem( id ) )
            return id;
        var tab = Ext.getCmp('irc-tab-panel').add({
            id: id,
            channelName: channel,
            title: Ext.util.Format.htmlEncode( channel ),
            iconCls: 'irc-icon',
            layout: 'border',
            margins: '0 0 0 0',
            items: [{
                region: 'center', 
                layout: 'fit', 
                border: false, 
                margins: '0 0 0 0',
                html: '<div style="height: 100%; width: 100%; overflow:auto; font-size:12px" id="'+id+'-el"></div>'
            },{
                xtype: 'treepanel',
                title: 'Users',
                region: 'east',
                layout: 'fit',
                split: true,
                border: false,
                margins: '0 0 0 0',
                width: 155,
                collapsible: true,
                id: 'user-tree-' + id,
                loader: new Ext.tree.TreeLoader(),
                rootVisible: false,
                lines: false,
                autoScroll: true,
                useArrows: true,
                root: new Ext.tree.AsyncTreeNode()
            }],
            closable: true,
            listeners: {
                activate: this.afterShowTab,
                destroy: this.afterRemoveTab,
                scope: this
            }
        });
		
        /*
                        children:[{
                            text:'Opped',
                            expanded:true,
                            children:[{
                                text:'Jack',
                                iconCls:'user',
                                leaf:true
                            },{
                                text:'Brian',
                                iconCls:'user',
                                leaf:true
                            },{
                                text:'Bob',
                                iconCls:'user',
                                leaf:true
                            }]
                        },{
                            text:'Voiced',
                            expanded:true,
                            children:[{
                                text:'Kelly',
                                iconCls:'user-voice',
                                leaf:true
                            },{
                                text:'Sara',
                                iconCls:'user-voice',
                                leaf:true
                            },{
                                text:'Zack',
                                iconCls:'user-voice',
                                leaf:true
                            },{
                                text:'John',
                                iconCls:'user-voice',
                                leaf:true
                            }]
                        }]
        */
        if ( act )
            Ext.getCmp('irc-tab-panel').activate( id );
        var tree = Ext.getCmp('user-tree-' + id );
		
		if (tab.channelName.indexOf("#") == 0)
		{
			var types = [ 'owner', 'prot', 'op', 'halfop', 'voice', 'normal' ];
			var typeDesc = [ '~Owner', '&Protected', '@Ops', '%Half-Ops', '+Voice', 'Normal' ];
			
			for ( var j = 0; j < types.length; j++ ) {
				var groupNode = new Ext.tree.TreeNode();
					groupNode.text = typeDesc[ j ];
					groupNode.iconCls = '';
					groupNode.leaf = false;
					groupNode.expanded = true;
					
				tree.root.appendChild(groupNode);
			}
		}
        tree.root.expand( true, true );
        this.channelIds.push( id );
        return id;
    }

});

Ext.reg( 'irc-client', Ext.ux.IRCClient );


